// Native Windows Share Sheet host for Electron (Windows 10/11, x64).
// Invoked with one EXISTING, locally generated PDF. The helper owns an HWND
// and supplies an actual StorageFile through IDataTransferManagerInterop.
// No PDF content is uploaded anywhere by this app; the user chooses a target.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shobjidl_core.h>
#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.ApplicationModel.DataTransfer.h>
#include <winrt/Windows.Storage.h>
#include <filesystem>
#include <iostream>
#include <thread>
#include <exception>

namespace dt=winrt::Windows::ApplicationModel::DataTransfer;
namespace storage=winrt::Windows::Storage;
static constexpr wchar_t CLASS_NAME[]=L"PFMShareHost";
static LRESULT CALLBACK WindowProc(HWND window,UINT msg,WPARAM w,LPARAM l){
 if(msg==WM_TIMER){KillTimer(window,1);DestroyWindow(window);return 0;}
 if(msg==WM_CLOSE){DestroyWindow(window);return 0;}
 if(msg==WM_DESTROY){PostQuitMessage(0);return 0;}
 return DefWindowProcW(window,msg,w,l);
}
static int fail(char const* reason){
 std::cout << "ERROR:" << reason << std::endl;
 return 2;
}
int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,LPWSTR,int){
 // Windows GUI subsystem hides a console while stdout remains captured by Node.
 int argc=0;
 auto args=CommandLineToArgvW(GetCommandLineW(),&argc);
 if(!args||argc!=2){if(args)LocalFree(args);return fail("PDF path required");}
 const std::wstring pdfPath=args[1];
 LocalFree(args);
 try{
  if(pdfPath.size()>32000||!std::filesystem::is_regular_file(pdfPath)||
     std::filesystem::path(pdfPath).extension()!=L".pdf")
   return fail("PDF path unavailable");
  if(std::filesystem::file_size(pdfPath)<1000)return fail("PDF file invalid");
  winrt::init_apartment(winrt::apartment_type::single_threaded);
  // Resolve the asynchronous StorageFile from a dedicated MTA worker to avoid
  // blocking the share window STA on IAsyncOperation::get().
  storage::StorageFile pdf{nullptr};
  std::exception_ptr loadError;
  std::thread loader([&]{
   try{
    winrt::init_apartment(winrt::apartment_type::multi_threaded);
    pdf=storage::StorageFile::GetFileFromPathAsync(pdfPath).get();
   }catch(...){loadError=std::current_exception();}
  });
  loader.join();
  if(loadError)std::rethrow_exception(loadError);
  WNDCLASSW wc{};wc.lpfnWndProc=WindowProc;wc.hInstance=instance;wc.lpszClassName=CLASS_NAME;
  wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);
  if(!RegisterClassW(&wc)&&GetLastError()!=ERROR_CLASS_ALREADY_EXISTS)return fail("Cannot register share window");
  HWND hwnd=CreateWindowExW(0,CLASS_NAME,L"Poultry Farm Management — PDF",
   WS_OVERLAPPED|WS_CAPTION|WS_SYSMENU, CW_USEDEFAULT,CW_USEDEFAULT,400,100,
   nullptr,nullptr,instance,nullptr);
  if(!hwnd)return fail("Cannot create share window");
  ShowWindow(hwnd,SW_SHOW);
  UpdateWindow(hwnd);
  auto interop=winrt::get_activation_factory<dt::DataTransferManager,IDataTransferManagerInterop>();
  dt::DataTransferManager manager{nullptr};
  winrt::check_hresult(interop->GetForWindow(hwnd,winrt::guid_of<dt::DataTransferManager>(),winrt::put_abi(manager)));
  auto requested=manager.DataRequested([pdf](auto const&,dt::DataRequestedEventArgs const& ev){
   auto data=ev.Request().Data();
   data.Properties().Title(L"Poultry Farm Management — PDF Report");
   data.Properties().Description(L"PDF report from Poultry Farm Management");
   auto attachments=winrt::single_threaded_vector<storage::IStorageItem>();
   attachments.Append(pdf);
   data.SetStorageItems(attachments);
  });
  SetTimer(hwnd,1,120000,nullptr);
  winrt::check_hresult(interop->ShowShareUIForWindow(hwnd));
  std::cout << "OPENED" << std::endl;
  MSG msg{};
  while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}
  manager.DataRequested(requested);
  winrt::uninit_apartment();
  return 0;
 }catch(winrt::hresult_error const& e){
  std::cout << "ERROR:Windows Share (" << std::hex << static_cast<unsigned>(e.code().value) << ")" << std::endl;
  return 3;
 }catch(std::exception const& e){
  std::cout << "ERROR:" << e.what() << std::endl;
  return 4;
 }
}
