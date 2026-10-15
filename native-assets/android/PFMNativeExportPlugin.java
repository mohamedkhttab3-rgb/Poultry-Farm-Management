package com.poultryfarm.manager;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
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
   getBridge().executeOnThreadPool(()->{
     try{
       byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
       if(bytes.length<1||bytes.length>32*1024*1024)throw new Exception("File size exceeds limit");
       if(excel&&(bytes.length<4||bytes[0]!=0x50||bytes[1]!=0x4b))throw new Exception("Invalid XLSX header");
       File file=temp(ext);
       try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);}
       getActivity().runOnUiThread(()->options(call,file,filename,mime));
     }catch(Exception e){fail(call,e);}
   });
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
   view.getSettings().setJavaScriptEnabled(false);
   view.getSettings().setAllowFileAccess(false);
   view.getSettings().setAllowContentAccess(false);
   view.setBackgroundColor(android.graphics.Color.WHITE);
   view.setAlpha(0f);
   parent.addView(view,new FrameLayout.LayoutParams(1180,850));
   Runnable cleanup=()->{if(view.getParent()!=null)parent.removeView(view);view.destroy();};
   java.util.function.Consumer<Exception> error=ex->{if(settled.compareAndSet(false,true)){cleanup.run();fail(call,ex);}};
   view.setWebViewClient(new WebViewClient(){
     @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
       return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
     }
     @Override public void onPageFinished(WebView v,String url){
       view.postDelayed(()->{
         if(settled.get())return;
         PrintDocumentAdapter adapter=view.createPrintDocumentAdapter(filename);
         PrintAttributes attrs=new PrintAttributes.Builder()
           .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
           .setResolution(new PrintAttributes.Resolution("pfm","300 dpi",300,300))
           .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
           .setColorMode(PrintAttributes.COLOR_MODE_COLOR).build();
         adapter.onStart();
         adapter.onLayout(null,attrs,new CancellationSignal(),new PrintDocumentAdapter.LayoutResultCallback(){
           @Override public void onLayoutFinished(PrintDocumentInfo info,boolean changed){
             final File pdf;
             final ParcelFileDescriptor fd;
             try{
               pdf=temp(".pdf");
               fd=ParcelFileDescriptor.open(pdf,ParcelFileDescriptor.MODE_READ_WRITE|ParcelFileDescriptor.MODE_CREATE|ParcelFileDescriptor.MODE_TRUNCATE);
             }catch(Exception e){adapter.onFinish();error.accept(e);return;}
             adapter.onWrite(new PageRange[]{PageRange.ALL_PAGES},fd,new CancellationSignal(),new PrintDocumentAdapter.WriteResultCallback(){
               void close(){try{fd.close();}catch(Exception ignored){}adapter.onFinish();}
               @Override public void onWriteFinished(PageRange[] pages){
                 close();
                 if(!settled.compareAndSet(false,true))return;
                 cleanup.run();
                 try{
                   if(pdf.length()<800)throw new Exception("PDF output was empty");
                   try(InputStream in=new FileInputStream(pdf)){
                     byte[] magic=new byte[5];
                     if(in.read(magic)!=5||!new String(magic,StandardCharsets.US_ASCII).equals("%PDF-"))throw new Exception("Invalid PDF output");
                   }
                   options(call,pdf,filename,PDF);
                 }catch(Exception e){fail(call,e);}
               }
               @Override public void onWriteFailed(CharSequence e){close();error.accept(new Exception("PDF failed: "+e));}
               @Override public void onWriteCancelled(){close();error.accept(new Exception("PDF canceled"));}
             });
           }
           @Override public void onLayoutFailed(CharSequence e){adapter.onFinish();error.accept(new Exception("PDF layout failed: "+e));}
           @Override public void onLayoutCancelled(){adapter.onFinish();error.accept(new Exception("PDF canceled"));}
         },new android.os.Bundle());
       },650);
     }
   });
   view.loadDataWithBaseURL("https://localhost/",html,"text/html","UTF-8",null);
   view.postDelayed(()->error.accept(new Exception("PDF export timed out")),45000);
 }
 private Uri uri(File f){return FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".pfmexport",f);}
 private void options(PluginCall c,File f,String filename,String mime){
   final boolean pdf=mime.equals(PDF);
   String[] menu={pdf?"فتح PDF / الطباعة":"فتح Excel","حفظ في التنزيلات أو المستندات",pdf?"مشاركة PDF":"مشاركة Excel","إلغاء"};
   new AlertDialog.Builder(getActivity())
    .setTitle(pdf?"تقرير PDF جاهز":"ملف Excel جاهز")
    .setItems(menu,(dialog,index)->{
      if(index==3){JSObject ret=new JSObject();ret.put("canceled",true);c.resolve(ret);return;}
      try{
        if(index==0){
          Intent view=new Intent(Intent.ACTION_VIEW);
          view.setDataAndType(uri(f),mime);
          view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          getActivity().startActivity(Intent.createChooser(view,"فتح الملف"));
          done(c,"open");
        }else if(index==1){
          if(pendingSave!=null){c.reject("A file save is already in progress");return;}
          pendingSave=f;
          Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);
          save.addCategory(Intent.CATEGORY_OPENABLE);save.setType(mime);
          save.putExtra(Intent.EXTRA_TITLE,filename);
          startActivityForResult(c,save,"onSaved");
        }else{
          Intent share=new Intent(Intent.ACTION_SEND);share.setType(mime);
          share.putExtra(Intent.EXTRA_STREAM,uri(f));
          share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          getActivity().startActivity(Intent.createChooser(share,"مشاركة الملف"));
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
   getBridge().executeOnThreadPool(()->{
     try(InputStream in=new FileInputStream(f);OutputStream out=getContext().getContentResolver().openOutputStream(target,"w")){
       if(out==null)throw new Exception("Could not write file");
       byte[] buf=new byte[65536];int count;
       while((count=in.read(buf))!=-1)out.write(buf,0,count);
       getActivity().runOnUiThread(()->Toast.makeText(getContext(),"تم حفظ الملف",Toast.LENGTH_SHORT).show());
       done(c,"save");
     }catch(Exception e){fail(c,e);}
   });
 }
}
