package com.poultryfarm.manager;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.print.PrintManager;
import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
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
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "PFMNativeExport")
public class PFMNativeExportPlugin extends Plugin {
 private static final String PDF="application/pdf";
 private static final String XLSX="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
 private File pendingSave;
 private File temp(String suffix) throws Exception {
   File dir=new File(getContext().getCacheDir(),"pfm-exports");
   if(!dir.isDirectory()&&!dir.mkdirs())throw new Exception("Cannot prepare export directory");
   return new File(dir,UUID.randomUUID().toString()+suffix);
 }
 private String name(String raw,String ext) {
   String n=(raw==null?"Poultry-Farm-Management"+ext:raw).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_").trim();
   if(n.isEmpty())n="Poultry-Farm-Management"+ext;
   if(n.length()>150)n=n.substring(0,150);
   if(!n.toLowerCase(java.util.Locale.ROOT).endsWith(ext))n+=ext;
   return n;
 }
 private void fail(PluginCall c,Exception e){c.reject(e.getMessage()==null?"Export error":e.getMessage());}
 private void done(PluginCall c,String action){
   JSObject res=new JSObject();res.put("ok",true);res.put("action",action);c.resolve(res);
 }
 @PluginMethod public void saveFile(PluginCall call){
   final String encoded=call.getString("data"),requested=call.getString("name");
   if(encoded==null||requested==null||encoded.length()>45_000_000){call.reject("Invalid or oversized file");return;}
   final boolean excel=requested.toLowerCase(java.util.Locale.ROOT).endsWith(".xlsx");
   final String mime=excel?XLSX:"application/json",ext=excel?".xlsx":".json",filename=name(requested,ext);
   new Thread(()->{
     try{
       byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
       if(bytes.length<1||bytes.length>32*1024*1024)throw new Exception("File size exceeds limit");
       if(excel){
         if(bytes.length<4||bytes[0]!=0x50||bytes[1]!=0x4b)throw new Exception("Invalid XLSX header");
         boolean workbook=false,types=false,worksheet=false;
         try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(bytes))){
           ZipEntry entry;int examined=0;
           while((entry=zip.getNextEntry())!=null){
             if(++examined>10000)throw new Exception("Invalid XLSX structure");
             String entryName=entry.getName();
             if("[Content_Types].xml".equals(entryName))types=true;
             if("xl/workbook.xml".equals(entryName))workbook=true;
             if(entryName.startsWith("xl/worksheets/")&&entryName.endsWith(".xml"))worksheet=true;
             zip.closeEntry();
           }
         }
         if(!workbook||!types||!worksheet)throw new Exception("Incomplete XLSX workbook");
       }
       File file=temp(ext);
       try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);}
       getActivity().runOnUiThread(()->options(call,file,filename,mime));
     }catch(Exception e){fail(call,e);}
   }).start();
 }
 @PluginMethod public void printHTML(PluginCall call){
   String html=call.getString("html");
   if(html==null||html.length()<40||html.length()>12000000||!html.contains("pfm59PrintRoot")){call.reject("Invalid report");return;}
   String filename=name(call.getString("name"),".pdf");
   getActivity().runOnUiThread(()->render(call,html,filename));
 }
 private void render(PluginCall call,String html,String filename){
   AtomicBoolean settled=new AtomicBoolean(false);
   FrameLayout parent=getActivity().findViewById(android.R.id.content);
   WebView view=new WebView(getActivity());
   view.getSettings().setJavaScriptEnabled(true);
   view.getSettings().setAllowFileAccess(false);
   view.getSettings().setAllowContentAccess(false);
   view.setBackgroundColor(android.graphics.Color.WHITE);
   // Keep the renderer opaque so direct View.draw() produces real pixels, while
   // positioning its host outside the visible device viewport.
   FrameLayout.LayoutParams offscreen=new FrameLayout.LayoutParams(1180,850);
   offscreen.leftMargin=-1400;
   view.setAlpha(1f);
   parent.addView(view,offscreen);
   Runnable cleanup=()->{if(view.getParent()!=null)parent.removeView(view);view.destroy();};
   java.util.function.Consumer<Exception> error=ex->{if(settled.compareAndSet(false,true)){cleanup.run();fail(call,ex);}};
   view.setWebViewClient(new WebViewClient(){
     private WebResourceResponse blocked(){
       return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
     }
     @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
       try {
         Uri target=request.getUrl();
         String file=target.getPath();
         if(file==null||file.contains(".."))return blocked();
         if(file.startsWith("/"))file=file.substring(1);
         String mime=null;
         if(file.endsWith(".css"))mime="text/css";
         else if(file.endsWith(".png"))mime="image/png";
         else if(file.endsWith(".svg"))mime="image/svg+xml";
         else if(file.endsWith(".jpg")||file.endsWith(".jpeg"))mime="image/jpeg";
         else if(file.endsWith(".webp"))mime="image/webp";
         if(mime==null||!target.getHost().equals("localhost"))return blocked();
         InputStream stream=getContext().getAssets().open("public/"+file);
         return new WebResourceResponse(mime,mime.startsWith("text/")?"UTF-8":null,stream);
       } catch(Exception ignored){return blocked();}
     }
     @Override public void onPageFinished(WebView v,String url){
       // Measure the actual result root, not body/viewport height. A stale CSS
       // min-height previously created a second empty PDF sheet.
       view.postDelayed(()->view.evaluateJavascript(
         "(function(){var r=document.getElementById('pfm59PrintRoot');if(!r)return 0;"+
         "var b=r.getBoundingClientRect();return Math.ceil(Math.max(0,b.bottom)+window.scrollY);})()",
         measured->{
         if(settled.get())return;
         try{
           // Render this read-only report into a real paginated PDF without Android
           // PrintDocumentAdapter callbacks (their constructors are package-private).
           int sourceWidth=1180;
           int contentHeight;
           try{contentHeight=(int)Math.ceil(Double.parseDouble(measured.replace("\\\"","")));}catch(Exception ignore){contentHeight=0;}
           if(contentHeight<=0)throw new Exception("Printable report is empty");
           if(contentHeight>100000)throw new Exception("Report is too long to render safely");
           view.measure(android.view.View.MeasureSpec.makeMeasureSpec(sourceWidth,android.view.View.MeasureSpec.EXACTLY),
             android.view.View.MeasureSpec.makeMeasureSpec(contentHeight,android.view.View.MeasureSpec.EXACTLY));
           view.layout(0,0,sourceWidth,contentHeight);
           int pageWidth=842,pageHeight=595,margin=23;
           float factor=(float)(pageWidth-2*margin)/sourceWidth;
           float slice=(pageHeight-margin-42)/factor;
           int pages=Math.max(1,(int)Math.ceil((contentHeight-2.0f)/slice));
           if(pages>160)throw new Exception("Report exceeds the page limit");
           android.graphics.pdf.PdfDocument document=new android.graphics.pdf.PdfDocument();
           File pdf=temp(".pdf");
           try{
             for(int index=0;index<pages;index++){
               android.graphics.pdf.PdfDocument.PageInfo pi=
                 new android.graphics.pdf.PdfDocument.PageInfo.Builder(pageWidth,pageHeight,index+1).create();
               android.graphics.pdf.PdfDocument.Page page=document.startPage(pi);
               android.graphics.Canvas canvas=page.getCanvas();
               canvas.drawColor(android.graphics.Color.WHITE);
               canvas.save();
               canvas.clipRect(margin,margin,pageWidth-margin,pageHeight-42);
               canvas.translate(margin,margin-index*slice*factor);
               canvas.scale(factor,factor);
               view.draw(canvas);
               canvas.restore();
               // Android-only per-page centered footer; draw outside the web content
               // so pagination cannot leave the brand on only the last page.
               android.graphics.Bitmap emblem=null;
               try(InputStream logo=getContext().getAssets().open("public/pfm-logo.png")){
                 emblem=android.graphics.BitmapFactory.decodeStream(logo);
               }catch(Exception ignored){}
               final String brand="Poultry Farm Management • Broiler Farm Intelligence";
               android.graphics.Paint ink=new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
               ink.setColor(android.graphics.Color.rgb(35,78,117));
               ink.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.BOLD));
               ink.setTextSize(13f);
               float lineWidth=ink.measureText(brand);
               float logoSize=21f, gap=8f;
               float total=lineWidth+gap+(emblem!=null?logoSize:0f);
               float left=(pageWidth-total)/2f;
               if(emblem!=null){
                 android.graphics.RectF target=new android.graphics.RectF(left,pageHeight-28, left+logoSize,pageHeight-7);
                 canvas.drawBitmap(emblem,null,target,new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG|android.graphics.Paint.FILTER_BITMAP_FLAG));
                 emblem.recycle();
               }
               canvas.drawText(brand,left+(emblem!=null?logoSize+gap:0f),pageHeight-12,ink);
               document.finishPage(page);
             }
             try(FileOutputStream out=new FileOutputStream(pdf)){document.writeTo(out);}
           }finally{document.close();}
           if(pdf.length()<800)throw new Exception("PDF is empty");
           try(InputStream in=new FileInputStream(pdf)){
             byte[] magic=new byte[5];
             if(in.read(magic)!=5||!new String(magic,StandardCharsets.US_ASCII).equals("%PDF-"))throw new Exception("Invalid PDF output");
           }
           if(!settled.compareAndSet(false,true))return;
           cleanup.run();
           options(call,pdf,filename,PDF);
         }catch(Exception e){error.accept(e);}
       }),850);
     }
   });
   view.loadDataWithBaseURL("https://localhost/",html,"text/html","UTF-8",null);
   view.postDelayed(()->error.accept(new Exception("PDF export timed out")),45000);
 }
 private Uri uri(File f){return FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".pfmexport",f);}
 private void printPdf(File pdf,String filename) {
   PrintManager printer=(PrintManager)getContext().getSystemService(Context.PRINT_SERVICE);
   if(printer==null)throw new IllegalStateException("Android print service is unavailable");
   PrintDocumentAdapter adapter=new PrintDocumentAdapter(){
     @Override public void onLayout(PrintAttributes oldAttributes,PrintAttributes newAttributes,
         CancellationSignal cancellationSignal,LayoutResultCallback callback,Bundle extras){
       if(cancellationSignal.isCanceled()){callback.onLayoutCancelled();return;}
       PrintDocumentInfo info=new PrintDocumentInfo.Builder(filename)
           .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
           .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN).build();
       callback.onLayoutFinished(info,true);
     }
     @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor destination,
         CancellationSignal cancellationSignal,WriteResultCallback callback){
       new Thread(()->{
         try(InputStream in=new FileInputStream(pdf);
             OutputStream out=new FileOutputStream(destination.getFileDescriptor())){
           byte[] buffer=new byte[64*1024];int n;
           while((n=in.read(buffer))!=-1){
             if(cancellationSignal.isCanceled()){
               getActivity().runOnUiThread(callback::onWriteCancelled);return;
             }
             out.write(buffer,0,n);
           }
           out.flush();
           getActivity().runOnUiThread(()->callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES}));
         }catch(Exception ex){
           getActivity().runOnUiThread(()->callback.onWriteFailed(ex.getMessage()));
         }
       }).start();
     }
   };
   PrintAttributes attributes=new PrintAttributes.Builder()
       .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
       .setColorMode(PrintAttributes.COLOR_MODE_COLOR).build();
   printer.print(filename,adapter,attributes);
 }
 private void options(PluginCall c,File f,String filename,String mime){
   final boolean pdf=mime.equals(PDF);
   String[] menu=pdf?
     new String[]{"فتح PDF","طباعة PDF","حفظ في التنزيلات أو المستندات","مشاركة PDF","إلغاء"}:
     new String[]{"فتح Excel","حفظ في التنزيلات أو المستندات","مشاركة Excel","إلغاء"};
   new AlertDialog.Builder(getActivity())
    .setTitle(pdf?"تقرير PDF جاهز":"ملف Excel جاهز")
    .setItems(menu,(dialog,index)->{
      int cancelIndex=pdf?4:3;
      if(index==cancelIndex){JSObject ret=new JSObject();ret.put("canceled",true);c.resolve(ret);return;}
      try{
        if(index==0){
          Intent view=new Intent(Intent.ACTION_VIEW);
          Uri sharedUri=uri(f);
          view.setDataAndType(sharedUri,mime);
          view.setClipData(android.content.ClipData.newRawUri(filename,sharedUri));
          view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          Intent chooser=Intent.createChooser(view,"فتح الملف");
          chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          getActivity().startActivity(chooser);
          done(c,"open");
        }else if(pdf&&index==1){
          printPdf(f,filename);done(c,"print");
        }else if(index==(pdf?2:1)){
          if(pendingSave!=null){c.reject("A file save is already in progress");return;}
          pendingSave=f;
          Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);
          save.addCategory(Intent.CATEGORY_OPENABLE);save.setType(mime);
          save.putExtra(Intent.EXTRA_TITLE,filename);
          startActivityForResult(c,save,"onSaved");
        }else{
          Uri sharedUri=uri(f);
          Intent share=new Intent(Intent.ACTION_SEND);
          share.setType(mime);
          share.putExtra(Intent.EXTRA_STREAM,sharedUri);
          share.setClipData(android.content.ClipData.newRawUri(filename,sharedUri));
          share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          Intent chooser=Intent.createChooser(share,"مشاركة الملف");
          chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          getActivity().startActivity(chooser);
          done(c,"share");
        }
      }catch(ActivityNotFoundException e){fail(c,new Exception("No compatible app; use Save or Share"));}
       catch(Exception e){fail(c,e);}
    })
    .setOnCancelListener(d->{JSObject ret=new JSObject();ret.put("canceled",true);c.resolve(ret);})
    .show();
 }
 @ActivityCallback private void onSaved(PluginCall c,ActivityResult result){
   File f=pendingSave;pendingSave=null;
   if(c==null)return;
   if(f==null){c.reject("File not found");return;}
   if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){
     JSObject ret=new JSObject();ret.put("canceled",true);c.resolve(ret);return;
   }
   Uri target=result.getData().getData();
   new Thread(()->{
     try(InputStream in=new FileInputStream(f);OutputStream out=getContext().getContentResolver().openOutputStream(target,"w")){
       if(out==null)throw new Exception("Could not write file");
       byte[] buf=new byte[65536];int count;
       while((count=in.read(buf))!=-1)out.write(buf,0,count);
       getActivity().runOnUiThread(()->Toast.makeText(getContext(),"تم حفظ الملف",Toast.LENGTH_SHORT).show());
       done(c,"save");
     }catch(Exception e){fail(c,e);}
   }).start();
 }
}
