package com.poultryfarm.manager;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.ClipData;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Android V7.3.5 - single native document engine.
 * PDF: create one verified paginated file with unbroken chart panels, stamp
 * a centered footer logo on EVERY page, then Print / Save / Share.
 * Excel: validate real XLSX and use Android's normal Save As picker.
 * No custom multi-choice export menus, no cached-file-only fake save,
 * no application data or desktop code changes.
 */
@CapacitorPlugin(name = "PFMNativeExport")
public final class PFMNativeExportPlugin extends Plugin {
  private static final String PDF="application/pdf";
  private static final String XLSX="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  private static final String JSON="application/json";
  private static final int MAX_BYTES=32*1024*1024;
  private static final int PAGE_W=842,PAGE_H=595;
  private static final int PAGE_MARGIN=27,FOOTER_RESERVED=75;
  private static final int RENDER_WIDTH=1120;
  private final Handler main=new Handler(Looper.getMainLooper());
  private final AtomicBoolean busy=new AtomicBoolean(false);
  private WebView reportView;
  private File pendingSave;
  private File workingFile;
  private PrintDocumentAdapter activePrint;

  private JSObject response(String action,boolean canceled){
    JSObject result=new JSObject();
    result.put("ok",!canceled);
    result.put("canceled",canceled);
    result.put("action",action);
    return result;
  }
  private void reject(PluginCall call,String message){
    busy.set(false);
    call.reject(message==null?"Document export failed":message);
  }
  private void finishWeb(){
    WebView web=reportView;
    reportView=null;
    if(web!=null){
      try{
        if(web.getParent() instanceof FrameLayout)
          ((FrameLayout)web.getParent()).removeView(web);
        web.destroy();
      }catch(Exception ignored){}
    }
  }
  private File temp(String suffix)throws Exception{
    File folder=new File(getContext().getCacheDir(),"pfm-exports");
    if(!folder.isDirectory()&&!folder.mkdirs())throw new Exception("Unable to prepare export folder");
    return new File(folder,UUID.randomUUID().toString()+suffix);
  }
  private String name(String raw,String extension){
    String value=raw==null?"PoultryFarmManagement":raw;
    value=value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_").trim();
    if(value.isEmpty())value="PoultryFarmManagement";
    if(value.length()>120)value=value.substring(0,120);
    if(!value.toLowerCase(Locale.ROOT).endsWith(extension))value+=extension;
    return value;
  }

  @PluginMethod public void printHTML(PluginCall call){
    startPdf(call,"print");
  }
  @PluginMethod public void savePDF(PluginCall call){
    startPdf(call,"save");
  }
  @PluginMethod public void sharePDF(PluginCall call){
    startPdf(call,"share");
  }
  private void startPdf(PluginCall call,String action){
    final String html=call.getString("html");
    if(html==null||html.length()<80||html.length()>12_000_000||!html.contains("pfm59PrintRoot")){
      call.reject("Printable report is missing or empty");return;
    }
    if(!busy.compareAndSet(false,true)){
      call.reject("Another document operation is in progress");return;
    }
    final String fileName=name(call.getString("name"),".pdf");
    main.post(()->prepareReport(call,html,fileName,action));
  }


  // V7.3.9: Completely new PDF engine. Android Chromium paginates the report
  // through its PrintDocumentAdapter. No Javascript page count, screenshots,
  // bitmap splitting, or custom Javascript PDF composer.
  private void prepareReport(PluginCall call,String html,String filename,String action){
    FrameLayout host=getActivity().findViewById(android.R.id.content);
    if(host==null){reject(call,"Android PDF print host unavailable");return;}
    final WebView web=new WebView(getActivity());
    reportView=web;
    final AtomicBoolean loaded=new AtomicBoolean(false);
    final AtomicBoolean completed=new AtomicBoolean(false);
    try{
      web.getSettings().setJavaScriptEnabled(false);
      web.getSettings().setAllowFileAccess(false);
      web.getSettings().setAllowContentAccess(false);
      web.getSettings().setBlockNetworkLoads(false);
      web.setBackgroundColor(Color.WHITE);
      FrameLayout.LayoutParams frame=new FrameLayout.LayoutParams(1120,800);
      frame.leftMargin=-1500;
      host.addView(web,frame);
      web.setWebViewClient(new WebViewClient(){
        private WebResourceResponse block(){
          return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView target,WebResourceRequest request){
          try{
            Uri u=request.getUrl();
            if(!"https".equals(u.getScheme())||!"localhost".equals(u.getHost()))return block();
            String path=u.getPath();
            if(path==null||!path.matches("/[A-Za-z0-9_./-]+")||path.contains(".."))return block();
            String file=path.substring(1),mime;
            if(file.endsWith(".css"))mime="text/css";
            else if(file.endsWith(".png"))mime="image/png";
            else if(file.endsWith(".svg"))mime="image/svg+xml";
            else if(file.endsWith(".jpg")||file.endsWith(".jpeg"))mime="image/jpeg";
            else if(file.endsWith(".webp"))mime="image/webp";
            else return block();
            return new WebResourceResponse(mime,mime.startsWith("text/")?"UTF-8":null,
              getContext().getAssets().open("public/"+file));
          }catch(Exception ignored){return block();}
        }
        @Override public void onPageFinished(WebView view,String url){
          if(!loaded.compareAndSet(false,true))return;
          // Allow local fonts, charts and logo to reach printing layout.
          main.postDelayed(()->{
            if(reportView==web&&!completed.get())writeNativePdf(call,web,filename,action,completed);
          },1800);
        }
        @Override public void onReceivedError(WebView view,int code,String description,String url){
          if("https://localhost/".equals(url)&&completed.compareAndSet(false,true)){
            finishWeb();reject(call,"PDF document failed to load: "+description);
          }
        }
      });
      String safe=html.replaceAll("(?is)<script\\b[^>]*>.*?</script>","")
        .replaceAll("(?is)<script\\b[^>]*?/?>","")
        .replaceAll("(?is)<base\\b[^>]*>","");
      if(!safe.matches("(?s).*?</head>.*"))throw new Exception("Invalid printable HTML");
      String css="<base href=\"https://localhost/\"/>"+
        "<link rel=\"stylesheet\" href=\"./pfm-v739-native-pdf.css\"/>";
      safe=safe.replaceFirst("(?i)</head>",css+"</head>");
      // The report's old footer does not repeat. The new fixed native-print
      // footer is repeated by Chromium at every printed page.
      safe=safe.replaceFirst("(?i)</body>",
        "<div class=\"pfm739-footer\"><img src=\"./pfm-logo.png\" alt=\"M.K\"/></div></body>");
      web.loadDataWithBaseURL("https://localhost/",safe,"text/html","UTF-8",null);
      main.postDelayed(()->{
        if(reportView==web && completed.compareAndSet(false,true)){
          finishWeb();reject(call,"Timed out while loading PDF document");
        }
      },45000);
    }catch(Exception e){completed.set(true);finishWeb();reject(call,e.getMessage());}
  }

  private void writeNativePdf(PluginCall call,WebView web,String filename,String action,AtomicBoolean completed){
    if(reportView!=web||completed.get())return;
    final File pdf;
    try{pdf=temp(".pdf");}catch(Exception e){completed.set(true);finishWeb();reject(call,e.getMessage());return;}
    final PrintDocumentAdapter adapter=web.createPrintDocumentAdapter(filename);
    final PrintAttributes attributes=new PrintAttributes.Builder()
      .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
      .setResolution(new PrintAttributes.Resolution("pfm","High quality",300,300))
      .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
      .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
      .build();
    try{
      adapter.onStart();
      adapter.onLayout(null,attributes,new CancellationSignal(),
        new PrintDocumentAdapter.LayoutResultCallback(){
          @Override public void onLayoutFinished(PrintDocumentInfo info,boolean changed){
            if(completed.get())return;
            try{
              final ParcelFileDescriptor output=ParcelFileDescriptor.open(pdf,
                ParcelFileDescriptor.MODE_CREATE|ParcelFileDescriptor.MODE_READ_WRITE|
                ParcelFileDescriptor.MODE_TRUNCATE);
              adapter.onWrite(new PageRange[]{PageRange.ALL_PAGES},output,
                new CancellationSignal(),new PrintDocumentAdapter.WriteResultCallback(){
                  private void close(){
                    try{output.close();}catch(Exception ignored){}
                    try{adapter.onFinish();}catch(Exception ignored){}
                  }
                  @Override public void onWriteFinished(PageRange[] pages){
                    close();
                    if(!completed.compareAndSet(false,true))return;
                    finishWeb();
                    new Thread(()->{
                      try{verifyPdf(pdf);main.post(()->deliverPdf(call,pdf,filename,action));}
                      catch(Exception e){pdf.delete();main.post(()->reject(call,"PDF validation failed: "+e.getMessage()));}
                    },"PFM-Native-PDF-verify").start();
                  }
                  @Override public void onWriteFailed(CharSequence message){
                    close();
                    if(completed.compareAndSet(false,true)){pdf.delete();finishWeb();reject(call,"PDF write failed: "+message);}
                  }
                  @Override public void onWriteCancelled(){
                    close();
                    if(completed.compareAndSet(false,true)){pdf.delete();finishWeb();reject(call,"PDF output canceled");}
                  }
                });
            }catch(Exception e){
              if(completed.compareAndSet(false,true)){try{adapter.onFinish();}catch(Exception ignored){}finishWeb();reject(call,e.getMessage());}
            }
          }
          @Override public void onLayoutFailed(CharSequence message){
            if(completed.compareAndSet(false,true)){try{adapter.onFinish();}catch(Exception ignored){}finishWeb();reject(call,"Android print layout failed: "+message);}
          }
          @Override public void onLayoutCancelled(){
            if(completed.compareAndSet(false,true)){try{adapter.onFinish();}catch(Exception ignored){}finishWeb();reject(call,"Android PDF layout canceled");}
          }
        },new Bundle());
    }catch(Exception e){
      if(completed.compareAndSet(false,true)){try{adapter.onFinish();}catch(Exception ignored){}finishWeb();reject(call,"PDF engine: "+e.getMessage());}
    }
  }
  private void verifyPdf(File file)throws Exception{
    if(!file.isFile()||file.length()<1300)throw new Exception("PDF is empty");
    try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);
        PdfRenderer renderer=new PdfRenderer(descriptor)){
      if(renderer.getPageCount()<1||renderer.getPageCount()>250)
        throw new Exception("Invalid page count");
      try(PdfRenderer.Page first=renderer.openPage(0)){
        Bitmap bitmap=Bitmap.createBitmap(560,397,Bitmap.Config.ARGB_8888);
        try{
          bitmap.eraseColor(Color.WHITE);
          first.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
          int ink=0;
          for(int y=12;y<340;y+=5)for(int x=12;x<548;x+=5){
            int p=bitmap.getPixel(x,y);
            if(Color.red(p)<220||Color.green(p)<220||Color.blue(p)<220)ink++;
          }
          if(ink<30)throw new Exception("Printable report appears blank");
        }finally{bitmap.recycle();}
      }
    }
  }
  private void deliverPdf(PluginCall call,File file,String filename,String action){
    try{
      if("save".equals(action)){
        saveAs(call,file,filename,PDF);
      }else if("share".equals(action)){
        Uri link=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".pfmexport",file);
        Intent send=new Intent(Intent.ACTION_SEND);
        send.setType(PDF);
        send.putExtra(Intent.EXTRA_STREAM,link);
        send.setClipData(ClipData.newRawUri(filename,link));
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(Intent.createChooser(send,"مشاركة تقرير PDF"));
        busy.set(false);
        call.resolve(response("share-dialog-opened",false));
      }else{
        printPdf(call,file,filename);
      }
    }catch(Exception e){reject(call,e.getMessage());}
  }
  private void printPdf(PluginCall call,File file,String filename){
    PrintManager manager=(PrintManager)getContext().getSystemService(Context.PRINT_SERVICE);
    if(manager==null){reject(call,"Android printing is not available");return;}
    PrintDocumentAdapter adapter=new PrintDocumentAdapter(){
      @Override public void onLayout(PrintAttributes before,PrintAttributes now,
          CancellationSignal signal,LayoutResultCallback callback,Bundle extras){
        if(signal.isCanceled()){callback.onLayoutCancelled();return;}
        callback.onLayoutFinished(new PrintDocumentInfo.Builder(filename)
          .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
          .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN).build(),true);
      }
      @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor fd,
          CancellationSignal signal,WriteResultCallback callback){
        new Thread(()->{
          try(InputStream in=new FileInputStream(file);
              OutputStream out=new FileOutputStream(fd.getFileDescriptor())){
            byte[] buffer=new byte[65536];int read;
            while((read=in.read(buffer))!=-1){
              if(signal.isCanceled()){main.post(callback::onWriteCancelled);return;}
              out.write(buffer,0,read);
            }
            out.flush();
            main.post(()->callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES}));
          }catch(Exception e){
            main.post(()->callback.onWriteFailed(e.getMessage()));
          }
        },"PFM-PDF-print").start();
      }
    };
    activePrint=adapter;
    PrintAttributes attrs=new PrintAttributes.Builder()
      .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
      .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
      .build();
    manager.print(filename,adapter,attrs);
    busy.set(false);
    call.resolve(response("print-dialog-opened",false));
  }

  @PluginMethod public void saveFile(PluginCall call){
    final String supplied=call.getString("name"),encoded=call.getString("data");
    if(supplied==null||encoded==null||encoded.length()>45_000_000){
      call.reject("Invalid file data");return;
    }
    final String lowercase=supplied.toLowerCase(Locale.ROOT);
    final boolean excel=lowercase.endsWith(".xlsx");
    if(!excel&&!lowercase.endsWith(".json")){call.reject("Only .xlsx and .json are supported");return;}
    if(!busy.compareAndSet(false,true)){call.reject("A document operation is already in progress");return;}
    final String extension=excel?".xlsx":".json";
    new Thread(()->{
      try{
        byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
        if(bytes.length==0||bytes.length>MAX_BYTES)throw new Exception("File size invalid");
        if(excel)checkWorkbook(bytes);
        File file=temp(extension);
        try(OutputStream output=new FileOutputStream(file)){output.write(bytes);output.flush();}
        main.post(()->saveAs(call,file,name(supplied,extension),excel?XLSX:JSON));
      }catch(Exception e){main.post(()->reject(call,"Excel save error: "+e.getMessage()));}
    },"PFM-Excel-validate").start();
  }
  private void checkWorkbook(byte[] bytes)throws Exception{
    if(bytes.length<40||bytes[0]!=0x50||bytes[1]!=0x4b)throw new Exception("Invalid XLSX ZIP header");
    Set<String> filenames=new HashSet<>();
    long total=0;int count=0;
    byte[] chunk=new byte[32768];
    try(ZipInputStream archive=new ZipInputStream(new ByteArrayInputStream(bytes))){
      ZipEntry entry;
      while((entry=archive.getNextEntry())!=null){
        if(++count>10000||entry.getName().contains(".."))throw new Exception("Unsafe XLSX archive");
        filenames.add(entry.getName());
        int n;
        while((n=archive.read(chunk))!=-1){
          total+=n;
          if(total>80L*1024*1024)throw new Exception("Workbook is too large");
        }
        archive.closeEntry();
      }
    }
    if(!filenames.contains("[Content_Types].xml")||!filenames.contains("xl/workbook.xml")||
        !filenames.contains("xl/_rels/workbook.xml.rels")||
        filenames.stream().noneMatch(n->n.startsWith("xl/worksheets/sheet")&&n.endsWith(".xml")))
      throw new Exception("Incomplete Excel workbook");
  }
  private void saveAs(PluginCall call,File file,String filename,String mime){
    try{
      pendingSave=file;workingFile=file;
      Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      save.addCategory(Intent.CATEGORY_OPENABLE);
      save.setType(mime);
      save.putExtra(Intent.EXTRA_TITLE,filename);
      startActivityForResult(call,save,"onSaveResult");
    }catch(Exception e){
      pendingSave=null;workingFile=null;file.delete();reject(call,"Cannot open Save As: "+e.getMessage());
    }
  }
  @ActivityCallback private void onSaveResult(PluginCall call,ActivityResult result){
    File source=pendingSave;
    pendingSave=null;
    if(call==null){busy.set(false);return;}
    if(source==null){reject(call,"Temporary document is missing");return;}
    Uri destination=result.getData()==null?null:result.getData().getData();
    if(result.getResultCode()!=Activity.RESULT_OK||destination==null){
      busy.set(false);call.resolve(response("save-canceled",true));return;
    }
    new Thread(()->{
      try(InputStream from=new FileInputStream(source);
          OutputStream to=getContext().getContentResolver().openOutputStream(destination,"w")){
        if(to==null)throw new Exception("Cannot write to destination");
        byte[] data=new byte[65536];long copied=0;int n;
        while((n=from.read(data))!=-1){to.write(data,0,n);copied+=n;}
        to.flush();
        if(copied!=source.length())throw new Exception("Saved file size differs from source");
        main.post(()->{busy.set(false);call.resolve(response("saved",false));});
      }catch(Exception e){main.post(()->reject(call,"Could not save document: "+e.getMessage()));}
    },"PFM-Save-As").start();
  }
}