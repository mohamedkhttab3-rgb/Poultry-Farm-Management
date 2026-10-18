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
 * Android V7.3.14 - native HTML A4 printing with preserved PDF exports.
 * PDF: draw the complete screen into one A4 sheet without
 * clipping or enlargement, stamp centered logo, then Print / Save / Share.
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
  private WebView nativePrintWeb;
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
    // Real HTML-printing through Android's WebView PrintDocumentAdapter.
    // Save/share use the existing, unchanged PDF file delivery route.
    if("print".equals(action))main.post(()->prepareNativePrint(call,html,fileName));
    else main.post(()->prepareReport(call,html,fileName,action));
  }



  // Android V7.3.14: print REAL report HTML (text, tables, SVG charts) using
  // Chromium's PrintDocumentAdapter. No screenshots or one-page compression.
  // The app's Save As, FileProvider share and XLSX flows are untouched.
  private void finishNativePrintWeb(WebView web){
    if(nativePrintWeb==web)nativePrintWeb=null;
    try{
      if(web.getParent() instanceof FrameLayout)
        ((FrameLayout)web.getParent()).removeView(web);
      web.destroy();
    }catch(Exception ignored){}
  }
  private void prepareNativePrint(PluginCall call,String html,String filename){
    FrameLayout host=getActivity().findViewById(android.R.id.content);
    if(host==null){reject(call,"Android print host is unavailable");return;}
    PrintManager manager=(PrintManager)getContext().getSystemService(Context.PRINT_SERVICE);
    if(manager==null){reject(call,"Android printing is not available");return;}
    final WebView web=new WebView(getActivity());
    nativePrintWeb=web;
    final AtomicBoolean loaded=new AtomicBoolean(false);
    try{
      web.getSettings().setJavaScriptEnabled(true);
      web.getSettings().setAllowFileAccess(false);
      web.getSettings().setAllowContentAccess(false);
      web.getSettings().setBlockNetworkLoads(true);
      web.setBackgroundColor(Color.WHITE);
      FrameLayout.LayoutParams frame=new FrameLayout.LayoutParams(RENDER_WIDTH,850);
      frame.leftMargin=-1500;
      host.addView(web,frame);
      web.setWebViewClient(new WebViewClient(){
        private WebResourceResponse block(){
          return new WebResourceResponse("text/plain","UTF-8",
            new ByteArrayInputStream(new byte[0]));
        }
        @Override public WebResourceResponse shouldInterceptRequest(
            WebView view,WebResourceRequest request){
          try{
            Uri uri=request.getUrl();
            if(!"https".equals(uri.getScheme())||!"localhost".equals(uri.getHost()))
              return block();
            String path=uri.getPath();
            if(path==null||!path.matches("/[A-Za-z0-9_./-]+")||
              path.contains(".."))return block();
            String file=path.substring(1),type;
            if(file.endsWith(".css"))type="text/css";
            else if(file.endsWith(".png"))type="image/png";
            else if(file.endsWith(".svg"))type="image/svg+xml";
            else if(file.endsWith(".jpg")||file.endsWith(".jpeg"))type="image/jpeg";
            else if(file.endsWith(".webp"))type="image/webp";
            else return block();
            return new WebResourceResponse(type,type.startsWith("text/")?"UTF-8":null,
              getContext().getAssets().open("public/"+file));
          }catch(Exception ignored){return block();}
        }
        @Override public void onPageFinished(WebView target,String url){
          if(!loaded.compareAndSet(false,true))return;
          main.postDelayed(()->launchNativePrint(call,web,manager,filename,0),400);
        }
        @Override public void onReceivedError(WebView target,int code,
            String description,String failingUrl){
          if("https://localhost/".equals(failingUrl)&&
            loaded.compareAndSet(false,true)){
            finishNativePrintWeb(web);
            reject(call,"Printable report could not load: "+description);
          }
        }
      });
      // Keep actual report HTML; remove executable scripts and external base tags.
      String safe=html.replaceAll("(?is)<script\\b[^>]*>.*?</script>","")
        .replaceAll("(?is)<script\\b[^>]*>","")
        .replaceAll("(?is)<base\\b[^>]*>","");
      if(!safe.matches("(?s).*?</head>.*")||!safe.matches("(?s).*</body>.*"))
        throw new Exception("Invalid HTML report for Android printing");
      safe=safe.replaceFirst("(?i)</head>",
        "<base href=\"https://localhost/\"/>"+
        "<link rel=\"stylesheet\" href=\"./pfm-v7314-native-print.css\"/></head>");
      safe=safe.replaceFirst("(?i)</body>",
        "<div class=\"pfm-native-a4-footer\"><img src=\"./pfm-logo.png\" alt=\"M.K\"/></div></body>");
      web.loadDataWithBaseURL("https://localhost/",safe,"text/html","UTF-8",null);
      main.postDelayed(()->{
        if(nativePrintWeb==web&&!loaded.get()){
          finishNativePrintWeb(web);
          reject(call,"Timed out loading Android print preview");
        }
      },30000);
    }catch(Exception e){
      finishNativePrintWeb(web);
      reject(call,"Cannot prepare Android print: "+e.getMessage());
    }
  }

  private void launchNativePrint(PluginCall call,WebView web,
      PrintManager manager,String filename,int attempts){
    if(nativePrintWeb!=web)return;
    final String ready="(function(){try{"+
      "var root=document.getElementById('pfm59PrintRoot');"+
      "if(!root)throw Error('Printable report content missing');"+
      "var images=document.images;var done=true;"+
      "for(var i=0;i<images.length;i++)if(!images[i].complete)done=false;"+
      "if(document.fonts&&document.fonts.status!=='loaded')done=false;"+
      "return JSON.stringify({ready:done,text:(root.textContent||'').trim().length});"+
      "}catch(e){return JSON.stringify({error:String(e&&e.message||e)});}})()";
    web.evaluateJavascript(ready,value->{
      try{
        Object raw=new JSONTokener(value==null?"null":value).nextValue();
        if(!(raw instanceof String))throw new Exception("Print layout returned no state");
        JSONObject info=new JSONObject((String)raw);
        if(info.has("error"))throw new Exception(info.getString("error"));
        if(info.getInt("text")<2)throw new Exception("The report is empty");
        if(!info.getBoolean("ready")&&attempts<12){
          main.postDelayed(()->launchNativePrint(call,web,manager,filename,attempts+1),350);
          return;
        }
        // Do not create LayoutResultCallback instances directly: Android
        // supplies them to the PrintDocumentAdapter delegate.
        final PrintDocumentAdapter renderer=web.createPrintDocumentAdapter(filename);
        final PrintDocumentAdapter adapter=new PrintDocumentAdapter(){
          @Override public void onStart(){renderer.onStart();}
          @Override public void onLayout(PrintAttributes oldAttrs,PrintAttributes newAttrs,
              CancellationSignal signal,LayoutResultCallback callback,Bundle extras){
            renderer.onLayout(oldAttrs,newAttrs,signal,callback,extras);
          }
          @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor destination,
              CancellationSignal signal,WriteResultCallback callback){
            renderer.onWrite(pages,destination,signal,callback);
          }
          @Override public void onFinish(){
            try{renderer.onFinish();}
            finally{
              activePrint=null;
              main.post(()->finishNativePrintWeb(web));
            }
          }
        };
        activePrint=adapter;
        PrintAttributes attrs=new PrintAttributes.Builder()
          .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
          .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
          .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
          .build();
        manager.print(filename,adapter,attrs);
        busy.set(false);
        call.resolve(response("print-dialog-opened",false));
      }catch(Exception e){
        finishNativePrintWeb(web);
        reject(call,"Android HTML printing failed: "+e.getMessage());
      }
    });
  }

  // Android V7.3.12: capture the ENTIRE printable screen as one A4 image.
  // No pagination, scroll slices, CSS zoom or per-chart/page grouping.
  // Native print, Save As, Share and XLSX remain separate, unchanged methods.
  private void prepareReport(PluginCall call,String html,String filename,String action){
    FrameLayout host=getActivity().findViewById(android.R.id.content);
    if(host==null){reject(call,"Cannot attach PDF renderer");return;}
    final WebView web=new WebView(getActivity());
    reportView=web;
    final AtomicBoolean loaded=new AtomicBoolean(false);
    try{
      web.getSettings().setJavaScriptEnabled(true);
      web.getSettings().setAllowFileAccess(false);
      web.getSettings().setAllowContentAccess(false);
      web.getSettings().setBlockNetworkLoads(false);
      web.getSettings().setUseWideViewPort(false);
      web.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE,null);
      web.setBackgroundColor(Color.WHITE);
      FrameLayout.LayoutParams frame=new FrameLayout.LayoutParams(RENDER_WIDTH,800);
      frame.leftMargin=-1500;
      host.addView(web,frame);
      web.setWebViewClient(new WebViewClient(){
        private WebResourceResponse block(){
          return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
          try{
            Uri uri=request.getUrl();
            if(!"https".equals(uri.getScheme())||!"localhost".equals(uri.getHost()))return block();
            String path=uri.getPath();
            if(path==null||!path.matches("/[A-Za-z0-9_./-]+")||path.contains(".."))return block();
            String file=path.substring(1),type;
            if(file.endsWith(".css"))type="text/css";
            else if(file.endsWith(".png"))type="image/png";
            else if(file.endsWith(".svg"))type="image/svg+xml";
            else if(file.endsWith(".jpeg")||file.endsWith(".jpg"))type="image/jpeg";
            else if(file.endsWith(".webp"))type="image/webp";
            else return block();
            return new WebResourceResponse(type,type.startsWith("text/")?"UTF-8":null,
              getContext().getAssets().open("public/"+file));
          }catch(Exception ignored){return block();}
        }
        @Override public void onPageFinished(WebView target,String url){
          if(!loaded.compareAndSet(false,true))return;
          main.postDelayed(()->measureFullScreen(call,web,filename,action),900);
        }
        @Override public void onReceivedError(WebView target,int code,String reason,String failed){
          if("https://localhost/".equals(failed)&&loaded.compareAndSet(false,true)){
            finishWeb();reject(call,"Unable to open report screen: "+reason);
          }
        }
      });
      String safe=html.replaceAll("(?is)<script\\b[^>]*>.*?</script>","")
        .replaceAll("(?is)<script\\b[^>]*>","")
        .replaceAll("(?is)<base\\b[^>]*>","");
      if(!safe.matches("(?s).*?</head>.*"))throw new Exception("Invalid PDF screen HTML");
      // The original results and colours are retained. Override only the
      // offscreen page-size/overflow rules so the whole screen is measurable.
      String oneImageCss="<style>"
        +"html,body,body.pfm59-printing{margin:0!important;padding:0!important;"
        +"width:1120px!important;min-width:1120px!important;max-width:1120px!important;"
        +"height:auto!important;min-height:0!important;max-height:none!important;"
        +"overflow:visible!important;background:white!important;}"
        +"html body.pfm59-printing #pfm59PrintRoot{display:block!important;"
        +"position:static!important;visibility:visible!important;transform:none!important;"
        +"width:1100px!important;min-width:1100px!important;max-width:1100px!important;"
        +"height:auto!important;max-height:none!important;overflow:visible!important;"
        +"margin:0!important;box-sizing:border-box!important;}"
        +"#pfm59PrintRoot .pfm59-print-footer{display:none!important;}"
        +"#pfm59PrintRoot .pfm59-report,#pfm59PrintRoot .report,"
        +"#pfm59PrintRoot .pfm59-dashboard,#pfm59PrintRoot .pfm59-table-section"
        +"{height:auto!important;max-height:none!important;overflow:visible!important;}"
        +"</style>";
      safe=safe.replaceFirst("(?i)</head>",
        "<base href=\"https://localhost/\"/>"+oneImageCss+"</head>");
      web.loadDataWithBaseURL("https://localhost/",safe,"text/html","UTF-8",null);
      main.postDelayed(()->{
        if(reportView==web&&!loaded.get()){
          finishWeb();reject(call,"Timed out loading PDF screen");
        }
      },45000);
    }catch(Exception e){finishWeb();reject(call,e.getMessage());}
  }

  private void measureFullScreen(PluginCall call,WebView web,String filename,String action){
    if(reportView!=web)return;
    final String js="(function(){try{"+
      "var root=document.getElementById('pfm59PrintRoot');"+
      "if(!root)throw Error('Printable screen was not found');"+
      "var top=root.getBoundingClientRect().top;"+
      "var max=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,"+
      "root.scrollHeight,root.getBoundingClientRect().height);"+
      "var els=root.querySelectorAll('*');"+
      "for(var i=0;i<els.length;i++){var r=els[i].getBoundingClientRect();"+
      "if(r.height>0&&r.bottom-top>max)max=r.bottom-top;}"+
      "var pending=0;var imgs=root.querySelectorAll('img');"+
      "for(var k=0;k<imgs.length;k++)if(!imgs[k].complete)pending++;"+
      "return JSON.stringify({height:Math.ceil(max+8),"+
      "text:(root.textContent||'').trim().length,pending:pending});"+
      "}catch(e){return JSON.stringify({error:String(e&&e.message||e)});}})()";
    web.evaluateJavascript(js,result->{
      try{
        Object raw=new JSONTokener(result==null?"null":result).nextValue();
        if(!(raw instanceof String))throw new Exception("PDF screen dimensions are missing");
        JSONObject info=new JSONObject((String)raw);
        if(info.has("error"))throw new Exception(info.getString("error"));
        if(info.getInt("pending")>0){
          // Wait for logos/embedded report images, with a finite limit.
          int attempts=web.getTag() instanceof Integer?(Integer)web.getTag():0;
          if(attempts<8){
            web.setTag(attempts+1);
            main.postDelayed(()->measureFullScreen(call,web,filename,action),500);
            return;
          }
        }
        int height=info.getInt("height");
        if(height<60||height>24000||info.getInt("text")<2)
          throw new Exception("Printable screen size is invalid");
        FrameLayout.LayoutParams params=(FrameLayout.LayoutParams)web.getLayoutParams();
        params.width=RENDER_WIDTH;
        params.height=height;
        web.setLayoutParams(params);
        web.measure(android.view.View.MeasureSpec.makeMeasureSpec(RENDER_WIDTH,
            android.view.View.MeasureSpec.EXACTLY),
          android.view.View.MeasureSpec.makeMeasureSpec(height,
            android.view.View.MeasureSpec.EXACTLY));
        web.layout(0,0,RENDER_WIDTH,height);
        web.scrollTo(0,0);
        web.invalidate();
        // Let Chromium paint the resized, full-height view before snapshotting.
        main.postDelayed(()->writeSingleA4(call,web,filename,action,height),700);
      }catch(Exception e){finishWeb();reject(call,"PDF screen preparation failed: "+e.getMessage());}
    });
  }

  // Draw the full Android WebView into one A4 PdfDocument page at source scale.
  // No intermediate giant bitmap: direct canvas output avoids OutOfMemoryError
  // on long reports. Width and height are always fitted WITHOUT enlargement.
  // Android FileProvider/SAF/PrintManager remain in the existing, separate
  // delivery methods below; no file:// URIs or storage permissions.
  private void writeSingleA4(PluginCall call,WebView web,String filename,
      String action,int height){
    if(reportView!=web)return;
    PdfDocument pdf=new PdfDocument();
    Bitmap logo=null;
    File output=null;
    try{
      output=temp(".pdf");
      try(InputStream in=getContext().getAssets().open("public/pfm-logo.png")){
        logo=BitmapFactory.decodeStream(in);
      }
      if(logo==null)throw new Exception("Report footer logo is missing");
      final int width=web.getWidth();
      if(width!=RENDER_WIDTH||web.getHeight()!=height)
        throw new Exception("Screen layout is not ready for PDF export");
      // Exact A4 landscape in PDF points; 27pt margin and a reserved logo strip.
      final float availableWidth=PAGE_W-2f*PAGE_MARGIN;
      final float availableHeight=PAGE_H-PAGE_MARGIN-FOOTER_RESERVED;
      final float scale=Math.min(1f,Math.min(availableWidth/width,
        availableHeight/(float)height));
      if(!(scale>0f)||!Float.isFinite(scale))
        throw new Exception("Invalid A4 scale");
      final float fittedWidth=width*scale;
      final float fittedHeight=height*scale;
      final float x=PAGE_MARGIN+(availableWidth-fittedWidth)/2f;
      final float y=PAGE_MARGIN+(availableHeight-fittedHeight)/2f;
      PdfDocument.Page page=pdf.startPage(
        new PdfDocument.PageInfo.Builder(PAGE_W,PAGE_H,1).create());
      Canvas paper=page.getCanvas();
      paper.drawColor(Color.WHITE);
      paper.save();
      paper.clipRect(x,y,x+fittedWidth,y+fittedHeight);
      paper.translate(x,y);
      paper.scale(scale,scale);
      web.scrollTo(0,0);
      // Original screen is drawn ONCE; no slicing, duplicate sheets or zoom.
      web.draw(paper);
      paper.restore();
      float logoSize=50f;
      RectF rect=new RectF((PAGE_W-logoSize)/2f,PAGE_H-64,
        (PAGE_W+logoSize)/2f,PAGE_H-14);
      paper.drawBitmap(logo,null,rect,
        new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG|
          android.graphics.Paint.FILTER_BITMAP_FLAG));
      pdf.finishPage(page);
      try(OutputStream destination=new FileOutputStream(output)){
        pdf.writeTo(destination);
      }
      logo.recycle();logo=null;
      pdf.close();pdf=null;
      finishWeb();
      final File verified=output;
      new Thread(()->{
        try{
          verifyPdf(verified);
          main.post(()->deliverPdf(call,verified,filename,action));
        }catch(Exception e){
          verified.delete();
          main.post(()->reject(call,"PDF integrity check failed: "+e.getMessage()));
        }
      },"PFM-A4-PDF-verify").start();
    }catch(Exception e){
      if(output!=null)output.delete();
      finishWeb();
      reject(call,"PDF export failed: "+e.getMessage());
    }finally{
      if(logo!=null)logo.recycle();
      if(pdf!=null)pdf.close();
    }
  }
  private void verifyPdf(File file)throws Exception{
    if(!file.isFile()||file.length()<1300)throw new Exception("PDF file is empty");
    try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);
        PdfRenderer renderer=new PdfRenderer(fd)){
      if(renderer.getPageCount()<1||renderer.getPageCount()>160)
        throw new Exception("Invalid PDF page count");
      try(PdfRenderer.Page first=renderer.openPage(0)){
        Bitmap bitmap=Bitmap.createBitmap(560,397,Bitmap.Config.ARGB_8888);
        try{
          bitmap.eraseColor(Color.WHITE);
          first.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
          int marks=0;
          for(int y=10;y<315;y+=4)for(int x=10;x<550;x+=4){
            int c=bitmap.getPixel(x,y);
            if(Color.red(c)<220||Color.green(c)<220||Color.blue(c)<220)marks++;
          }
          if(marks<35)throw new Exception("Report body appears blank");
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