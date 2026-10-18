package com.poultryfarm.manager;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
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
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Android V7.3.4. Exactly two independent actions:
 * (1) Print report using Android system print dialog (including system Save as PDF).
 * (2) Save XLSX (and existing JSON backups) using Android Create Document.
 * Does not generate PDF bitmaps, show custom export menus, or touch app data.
 */
@CapacitorPlugin(name = "PFMNativeExport")
public final class PFMNativeExportPlugin extends Plugin {
  private static final String XLSX="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  private static final String JSON="application/json";
  private static final int MAX_BYTES=32*1024*1024;
  private final Handler ui=new Handler(Looper.getMainLooper());
  private final AtomicBoolean saving=new AtomicBoolean(false);
  private final AtomicBoolean printing=new AtomicBoolean(false);
  private File pendingSave;
  private WebView printWebView;

  private void clearPrint(){
    WebView web=printWebView;printWebView=null;
    if(web!=null){
      try { if(web.getParent() instanceof FrameLayout)
        ((FrameLayout)web.getParent()).removeView(web); } catch(Exception ignored){}
      try { web.destroy(); } catch(Exception ignored){}
    }
    printing.set(false);
  }
  private void clearSave(){
    File file=pendingSave;pendingSave=null;
    if(file!=null)file.delete();
    saving.set(false);
  }
  private JSObject result(String action,boolean canceled){
    JSObject r=new JSObject();r.put("ok",!canceled);
    r.put("canceled",canceled);r.put("action",action);return r;
  }
  private String safeName(String provided,String extension){
    String name=provided==null?"PoultryFarmManagement":provided;
    name=name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_").trim();
    if(name.length()>110)name=name.substring(0,110);
    if(name.isEmpty())name="PoultryFarmManagement";
    if(!name.toLowerCase(Locale.ROOT).endsWith(extension))name+=extension;
    return name;
  }
  private File temp(String suffix)throws Exception{
    File dir=new File(getContext().getCacheDir(),"pfm-exports");
    if(!dir.isDirectory()&&!dir.mkdirs())throw new Exception("Cannot prepare storage");
    return new File(dir,UUID.randomUUID()+suffix);
  }

  @PluginMethod public void printHTML(PluginCall call){
    String html=call.getString("html");
    if(html==null||html.length()<80||html.length()>12_000_000
       ||!html.contains("id=\"pfm59PrintRoot\"")){
      call.reject("Printable report is empty or invalid");return;
    }
    if(!printing.compareAndSet(false,true)){
      call.reject("A print dialog is already in progress");return;
    }
    final String title=safeName(call.getString("name"),".pdf");
    ui.post(()->startPrint(call,html,title));
  }
  private void startPrint(PluginCall call,String html,String title){
    FrameLayout holder=getActivity().findViewById(android.R.id.content);
    if(holder==null){printing.set(false);call.reject("Unable to prepare Android print screen");return;}
    final WebView web=new WebView(getActivity());
    printWebView=web;
    try{
      web.getSettings().setJavaScriptEnabled(false);
      web.getSettings().setAllowFileAccess(false);
      web.getSettings().setAllowContentAccess(false);
      web.getSettings().setBlockNetworkLoads(true);
      web.setBackgroundColor(android.graphics.Color.WHITE);
      FrameLayout.LayoutParams frame=new FrameLayout.LayoutParams(1100,800);
      frame.leftMargin=-1200;
      holder.addView(web,frame);
      AtomicBoolean started=new AtomicBoolean(false);
      web.setWebViewClient(new WebViewClient(){
        private WebResourceResponse blocked(){
          return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
          try{
            Uri u=request.getUrl();
            if(!"https".equals(u.getScheme())||!"localhost".equals(u.getHost()))return blocked();
            String file=u.getPath();
            if(file==null||!file.startsWith("/")||file.contains("..")||file.contains("\\"))return blocked();
            file=file.substring(1);
            String type;
            if(file.endsWith(".css"))type="text/css";
            else if(file.endsWith(".png"))type="image/png";
            else if(file.endsWith(".jpg")||file.endsWith(".jpeg"))type="image/jpeg";
            else if(file.endsWith(".webp"))type="image/webp";
            else if(file.endsWith(".svg"))type="image/svg+xml";
            else return blocked();
            return new WebResourceResponse(type,type.startsWith("text/")?"UTF-8":null,
              getContext().getAssets().open("public/"+file));
          }catch(Exception e){return blocked();}
        }
        @Override public void onPageFinished(WebView view,String url){
          if(!started.compareAndSet(false,true))return;
          ui.postDelayed(()->{
            try{
              if(printWebView!=web)return;
              PrintManager printer=(PrintManager)getContext().getSystemService(android.content.Context.PRINT_SERVICE);
              if(printer==null)throw new Exception("Android print service unavailable");
              PrintDocumentAdapter delegate=web.createPrintDocumentAdapter(title);
              PrintDocumentAdapter controlled=new PrintDocumentAdapter(){
                @Override public void onStart(){delegate.onStart();}
                @Override public void onLayout(PrintAttributes oldAttributes,PrintAttributes newAttributes,
                    CancellationSignal cancellationSignal,LayoutResultCallback callback,Bundle extras){
                  delegate.onLayout(oldAttributes,newAttributes,cancellationSignal,callback,extras);
                }
                @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor output,
                    CancellationSignal cancellationSignal,WriteResultCallback callback){
                  delegate.onWrite(pages,output,cancellationSignal,callback);
                }
                @Override public void onFinish(){
                  try{delegate.onFinish();}finally{ui.post(()->{
                    if(printWebView==web)clearPrint();
                  });}
                }
              };
              PrintAttributes config=new PrintAttributes.Builder()
                  .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                  .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                  .build();
              printer.print(title,controlled,config);
              // The Android print UI now owns printing and Save-as-PDF.
              // Opening it does NOT mean the user printed a page.
              call.resolve(result("print-dialog-opened",false));
            }catch(Exception error){
              if(printWebView==web)clearPrint();
              call.reject("Cannot open printing: "+error.getMessage());
            }
          },600);
        }
        @Override public void onReceivedError(WebView view,int errorCode,String description,String failingUrl){
          if("https://localhost/".equals(failingUrl) && started.compareAndSet(false,true)){
            if(printWebView==web)clearPrint();
            call.reject("Printable report failed to load");
          }
        }
      });
      String page=html.replaceAll("(?is)<base\\b[^>]*>","");
      if(!page.contains("</head>"))throw new Exception("Report document head missing");
      page=page.replaceFirst("(?i)</head>","<base href=\"https://localhost/\"/></head>");
      web.loadDataWithBaseURL("https://localhost/",page,"text/html","UTF-8",null);
      ui.postDelayed(()->{
        if(printWebView==web && !started.get()){
          started.set(true);clearPrint();call.reject("Timed out opening report for printing");
        }
      },30000);
    }catch(Exception error){
      if(printWebView==web)clearPrint();
      call.reject(error.getMessage());
    }
  }

  @PluginMethod public void saveFile(PluginCall call){
    String requested=call.getString("name"),encoded=call.getString("data");
    if(requested==null||encoded==null||encoded.length()>45_000_000){
      call.reject("Invalid file");return;
    }
    String lower=requested.toLowerCase(Locale.ROOT);
    boolean xlsx=lower.endsWith(".xlsx"),json=lower.endsWith(".json");
    if(!xlsx&&!json){call.reject("Only XLSX and JSON saving is supported");return;}
    if(!saving.compareAndSet(false,true)){call.reject("A file save is already in progress");return;}
    String extension=xlsx?".xlsx":".json";
    String filename=safeName(requested,extension);
    String mime=xlsx?XLSX:JSON;
    new Thread(()->{
      try{
        byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
        if(bytes.length<1||bytes.length>MAX_BYTES)throw new Exception("Invalid file size");
        if(xlsx)checkWorkbook(bytes);
        File file=temp(extension);
        try(OutputStream out=new FileOutputStream(file)){out.write(bytes);out.flush();}
        ui.post(()->chooseSave(call,file,filename,mime));
      }catch(Exception error){
        ui.post(()->{clearSave();call.reject("Cannot prepare file: "+error.getMessage());});
      }
    },"PFM-file-prepare").start();
  }
  private void checkWorkbook(byte[] data)throws Exception{
    if(data.length<40||data[0]!=0x50||data[1]!=0x4b)
      throw new Exception("Excel file does not contain a valid ZIP workbook");
    Set<String> found=new HashSet<>();byte[] buffer=new byte[32768];
    try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(data))){
      ZipEntry entry;int count=0;long total=0;
      while((entry=zip.getNextEntry())!=null){
        if(++count>10000||entry.getName().contains(".."))throw new Exception("Invalid workbook archive");
        found.add(entry.getName());int n;
        while((n=zip.read(buffer))!=-1){
          total+=n;
          if(total>80L*1024*1024)throw new Exception("Workbook data is too large");
        }
        zip.closeEntry();
      }
    }
    if(!found.contains("[Content_Types].xml")||
       !found.contains("xl/workbook.xml")||
       !found.contains("xl/_rels/workbook.xml.rels")||
       found.stream().noneMatch(x->x.startsWith("xl/worksheets/sheet")&&x.endsWith(".xml")))
      throw new Exception("Excel workbook is missing sheets or metadata");
  }
  private void chooseSave(PluginCall call,File file,String filename,String mime){
    try{
      pendingSave=file;
      Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      save.addCategory(Intent.CATEGORY_OPENABLE);
      save.setType(mime);
      save.putExtra(Intent.EXTRA_TITLE,filename);
      startActivityForResult(call,save,"onSaveResult");
    }catch(Exception error){
      clearSave();call.reject("Cannot open file save: "+error.getMessage());
    }
  }
  @ActivityCallback private void onSaveResult(PluginCall call,ActivityResult callback){
    if(call==null){clearSave();return;}
    File source=pendingSave;
    if(source==null){clearSave();call.reject("Export file expired");return;}
    Uri location=callback.getData()==null?null:callback.getData().getData();
    if(callback.getResultCode()!=Activity.RESULT_OK||location==null){
      clearSave();call.resolve(result("save-canceled",true));return;
    }
    new Thread(()->{
      try(InputStream in=new FileInputStream(source);
          OutputStream out=getContext().getContentResolver().openOutputStream(location,"w")){
        if(out==null)throw new Exception("Cannot write to selected folder");
        long written=0;byte[] bytes=new byte[65536];int count;
        while((count=in.read(bytes))!=-1){out.write(bytes,0,count);written+=count;}
        out.flush();
        if(written!=source.length())throw new Exception("Saved file size mismatch");
        ui.post(()->{clearSave();call.resolve(result("saved",false));});
      }catch(Exception ex){
        ui.post(()->{clearSave();call.reject("Saving failed: "+ex.getMessage());});
      }
    },"PFM-save-document").start();
  }
}