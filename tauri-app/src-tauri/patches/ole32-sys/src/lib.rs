// Copyright © 2015, Peter Atashian
// Licensed under the MIT License <LICENSE.md>
//! FFI bindings to ole32.
#![cfg(windows)]
extern crate winapi;
use std::ffi::c_void;
use winapi::*;

extern "system" {
    // pub fn BindMoniker();
    // pub fn CLIPFORMAT_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn CLIPFORMAT_UserFree64();
    // pub fn CLIPFORMAT_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn CLIPFORMAT_UserMarshal64();
    // pub fn CLIPFORMAT_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn CLIPFORMAT_UserSize64();
    // pub fn CLIPFORMAT_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn CLIPFORMAT_UserUnmarshal64();
    // pub fn CLSIDFromProgID();
    // pub fn CLSIDFromProgIDEx();
    // pub fn CLSIDFromString();
    // pub fn CoAddRefServerProcess();
    // pub fn CoAllowSetForegroundWindow();
    pub fn CoAllowUnmarshalerCLSID(clsid: REFCLSID) -> HRESULT;
    // pub fn CoBuildVersion();
    // pub fn CoCancelCall();
    // pub fn CoCopyProxy();
    // pub fn CoCreateFreeThreadedMarshaler();
    // pub fn CoCreateGuid();
    pub fn CoCreateInstance(
        rclsid: REFCLSID, pUnkOuter: LPUNKNOWN, dwClsContext: DWORD, riid: REFIID,
        ppv: *mut LPVOID,
    ) -> HRESULT;
    // pub fn CoCreateInstanceEx();
    // pub fn CoCreateInstanceFromApp();
    // pub fn CoCreateObjectInContext();
    // pub fn CoDeactivateObject();
    pub fn CoDecodeProxy(
        dwClientPid: DWORD, ui64ProxyAddress: UINT64, pServerInformation: PServerInformation,
    ) -> HRESULT;
    pub fn CoDecrementMTAUsage(Cookie: CO_MTA_USAGE_COOKIE) -> HRESULT;
    // pub fn CoDisableCallCancellation();
    // pub fn CoDisconnectContext();
    // pub fn CoDisconnectObject();
    // pub fn CoDosDateTimeToFileTime();
    // pub fn CoEnableCallCancellation();
    // pub fn CoFileTimeNow();
    // pub fn CoFileTimeToDosDateTime();
    // pub fn CoFreeAllLibraries();
    // pub fn CoFreeLibrary();
    // pub fn CoFreeUnusedLibraries();
    // pub fn CoFreeUnusedLibrariesEx();
    // pub fn CoGetApartmentID();
    pub fn CoGetApartmentType(
        pAptType: *mut APTTYPE, pAptQualifier: *mut APTTYPEQUALIFIER,
    ) -> HRESULT;
    // pub fn CoGetCallContext();
    pub fn CoGetCallerTID(lpdwTID: LPDWORD) -> HRESULT;
    // pub fn CoGetCancelObject();
    pub fn CoGetClassObject(
        rclsid: REFCLSID, dwClsContext: DWORD, pvReserved: LPVOID, riid: REFIID, ppv: *mut LPVOID,
    ) -> HRESULT;
    // pub fn CoGetClassVersion();
    // pub fn CoGetComCatalog();
    pub fn CoGetContextToken(pToken: *mut ULONG_PTR) -> HRESULT;
    pub fn CoGetCurrentLogicalThreadId(pguid: *mut GUID) -> HRESULT;
    pub fn CoGetCurrentProcess() -> DWORD;
    pub fn CoGetDefaultContext(aptType: APTTYPE, riid: REFIID, ppv: *mut *mut c_void) -> HRESULT;
    // pub fn CoGetInstanceFromFile();
    // pub fn CoGetInstanceFromIStorage();
    // pub fn CoGetInterceptor();
    // pub fn CoGetInterceptorFromTypeInfo();
    // pub fn CoGetInterfaceAndReleaseStream();
    pub fn CoGetMalloc(dwMemContext: DWORD, ppMalloc: *mut LPMALLOC) -> HRESULT;
    // pub fn CoGetMarshalSizeMax();
    // pub fn CoGetObject();
    pub fn CoGetObjectContext(riid: REFIID, ppv: *mut LPVOID) -> HRESULT;
    // pub fn CoGetPSClsid();
    // pub fn CoGetProcessIdentifier();
    pub fn CoGetStandardMarshal();
    // pub fn CoGetStdMarshalEx();
    // pub fn CoGetSystemSecurityPermissions();
    // pub fn CoGetTreatAsClass();
    // pub fn CoHandlePriorityEventsFromMessagePump();
    // pub fn CoImpersonateClient();
    pub fn CoIncrementMTAUsage(pCookie: *mut CO_MTA_USAGE_COOKIE) -> HRESULT;
    pub fn CoInitializeEx(pvReserved: LPVOID, dwCoInit: DWORD) -> HRESULT;
    // pub fn CoInitializeEx();
    // pub fn CoInitializeSecurity();
    // pub fn CoInitializeWOW();
    // pub fn CoInstall();
    // pub fn CoInvalidateRemoteMachineBindings();
    // pub fn CoIsHandlerConnected();
    // pub fn CoIsOle1Class();
    // pub fn CoLoadLibrary();
    // pub fn CoLockObjectExternal();
    // pub fn CoMarshalHresult();
    // pub fn CoMarshalInterThreadInterfaceInStream();
    // pub fn CoMarshalInterface();
    // pub fn CoQueryAuthenticationServices();
    // pub fn CoQueryClientBlanket();
    // pub fn CoQueryProxyBlanket();
    // pub fn CoQueryReleaseObject();
    // pub fn CoReactivateObject();
    // pub fn CoRegisterActivationFilter();
    // pub fn CoRegisterChannelHook();
    pub fn CoRegisterClassObject(
        rclsid: REFCLSID, pUnk: LPUNKNOWN, dwClsContext: DWORD, flags: DWORD,
        lpdwRegister: LPDWORD,
    ) -> HRESULT;
    // pub fn CoRegisterInitializeSpy();
    // pub fn CoRegisterMallocSpy();
    // pub fn CoRegisterMessageFilter();
    // pub fn CoRegisterPSClsid();
    // pub fn CoRegisterSurrogate();
    // pub fn CoRegisterSurrogateEx();
    // pub fn CoReleaseMarshalData();
    // pub fn CoReleaseServerProcess();
    // pub fn CoResumeClassObjects();
    // pub fn CoRetireServer();
    // pub fn CoRevertToSelf();
    pub fn CoRevokeClassObject() -> HRESULT;
    // pub fn CoRevokeInitializeSpy();
    // pub fn CoRevokeMallocSpy();
    // pub fn CoSetCancelObject();
    // pub fn CoSetMessageDispatcher();
    // pub fn CoSetProxyBlanket();
    // pub fn CoSuspendClassObjects();
    // pub fn CoSwitchCallContext();
    pub fn CoTaskMemAlloc(cb: SIZE_T) -> LPVOID;
    pub fn CoTaskMemFree(pv: LPVOID);
    pub fn CoTaskMemRealloc(pv: LPVOID, cb: SIZE_T) -> LPVOID;
    // pub fn CoTestCancel();
    // pub fn CoTreatAsClass();
    pub fn CoUninitialize();
    // pub fn CoUnloadingWOW();
    // pub fn CoUnmarshalHresult();
    // pub fn CoUnmarshalInterface();
    // pub fn CoWaitForMultipleHandles();
    // pub fn CoWaitForMultipleObjects();
    // pub fn ComPs_NdrDllCanUnloadNow();
    // pub fn ComPs_NdrDllGetClassObject();
    // pub fn ComPs_NdrDllRegisterProxy();
    // pub fn CreateAntiMoniker();
    // pub fn CreateBindCtx();
    // pub fn CreateClassMoniker();
    // pub fn CreateDataAdviseHolder();
    // pub fn CreateDataCache();
    // pub fn CreateFileMoniker();
    // pub fn CreateGenericComposite();
    // pub fn CreateILockBytesOnHGlobal();
    // pub fn CreateItemMoniker();
    // pub fn CreateObjrefMoniker();
    // pub fn CreateOleAdviseHolder();
    // pub fn CreatePointerMoniker();
    // pub fn CreateStdProgressIndicator();
    pub fn CreateStreamOnHGlobal(
        hGlobal: HGLOBAL, fDeleteOnRelease: BOOL, ppstm: *mut LPSTREAM,
    ) -> HRESULT;
    // pub fn DcomChannelSetHResult();
    // pub fn DllDebugObjectRPCHook();
    // pub fn DllGetClassObjectWOW();
    // pub fn DoDragDrop();
    // pub fn EnableHookObject();
    // pub fn FmtIdToPropStgName();
    // pub fn FreePropVariantArray();
    // pub fn GetActiveObjectExt();
    // pub fn GetClassFile();
    // pub fn GetConvertStg();
    // pub fn GetDocumentBitStg();
    // pub fn GetHGlobalFromILockBytes();
    pub fn GetHGlobalFromStream(pstm: LPSTREAM, phglobal: *mut HGLOBAL) -> HRESULT;
    // pub fn GetHookInterface();
    // pub fn GetRunningObjectTable();
    // pub fn HACCEL_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HACCEL_UserFree64();
    // pub fn HACCEL_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HACCEL_UserMarshal64();
    // pub fn HACCEL_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HACCEL_UserSize64();
    // pub fn HACCEL_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HACCEL_UserUnmarshal64();
    // pub fn HBITMAP_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBITMAP_UserFree64();
    // pub fn HBITMAP_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBITMAP_UserMarshal64();
    // pub fn HBITMAP_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBITMAP_UserSize64();
    // pub fn HBITMAP_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBITMAP_UserUnmarshal64();
    // pub fn HBRUSH_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBRUSH_UserFree64();
    // pub fn HBRUSH_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBRUSH_UserMarshal64();
    // pub fn HBRUSH_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBRUSH_UserSize64();
    // pub fn HBRUSH_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HBRUSH_UserUnmarshal64();
    // pub fn HDC_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HDC_UserFree64();
    // pub fn HDC_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HDC_UserMarshal64();
    // pub fn HDC_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HDC_UserSize64();
    // pub fn HDC_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HDC_UserUnmarshal64();
    // pub fn HENHMETAFILE_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HENHMETAFILE_UserFree64();
    // pub fn HENHMETAFILE_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HENHMETAFILE_UserMarshal64();
    // pub fn HENHMETAFILE_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HENHMETAFILE_UserSize64();
    // pub fn HENHMETAFILE_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HENHMETAFILE_UserUnmarshal64();
    // pub fn HGLOBAL_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HGLOBAL_UserFree64();
    // pub fn HGLOBAL_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HGLOBAL_UserMarshal64();
    // pub fn HGLOBAL_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HGLOBAL_UserSize64();
    // pub fn HGLOBAL_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HGLOBAL_UserUnmarshal64();
    // pub fn HICON_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HICON_UserFree64();
    // pub fn HICON_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HICON_UserMarshal64();
    // pub fn HICON_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HICON_UserSize64();
    // pub fn HICON_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HICON_UserUnmarshal64();
    // pub fn HMENU_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMENU_UserFree64();
    // pub fn HMENU_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMENU_UserMarshal64();
    // pub fn HMENU_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMENU_UserSize64();
    // pub fn HMENU_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMENU_UserUnmarshal64();
    // pub fn HMETAFILEPICT_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILEPICT_UserFree64();
    // pub fn HMETAFILEPICT_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILEPICT_UserMarshal64();
    // pub fn HMETAFILEPICT_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILEPICT_UserSize64();
    // pub fn HMETAFILEPICT_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILEPICT_UserUnmarshal64();
    // pub fn HMETAFILE_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILE_UserFree64();
    // pub fn HMETAFILE_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILE_UserMarshal64();
    // pub fn HMETAFILE_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILE_UserSize64();
    // pub fn HMETAFILE_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMETAFILE_UserUnmarshal64();
    // pub fn HMONITOR_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMONITOR_UserFree64();
    // pub fn HMONITOR_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMONITOR_UserMarshal64();
    // pub fn HMONITOR_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMONITOR_UserSize64();
    // pub fn HMONITOR_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HMONITOR_UserUnmarshal64();
    // pub fn HPALETTE_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HPALETTE_UserFree64();
    // pub fn HPALETTE_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HPALETTE_UserMarshal64();
    // pub fn HPALETTE_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HPALETTE_UserSize64();
    // pub fn HPALETTE_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HPALETTE_UserUnmarshal64();
    // pub fn HWND_UserFree();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HWND_UserFree64();
    // pub fn HWND_UserMarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HWND_UserMarshal64();
    // pub fn HWND_UserSize();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HWND_UserSize64();
    // pub fn HWND_UserUnmarshal();
    // #[cfg(target_arch = "x86_64")]
    // pub fn HWND_UserUnmarshal64();
    // pub fn HkOleRegisterObject();
    // pub fn IIDFromString();
    // pub fn IsAccelerator();
    // pub fn IsEqualGUID();
    // pub fn MkParseDisplayName();
    // pub fn MonikerCommonPrefixWith();
    // pub fn MonikerRelativePathTo();
    // pub fn NdrProxyForwardingFunction10();
    // pub fn NdrProxyForwardingFunction11();
    // pub fn NdrProxyForwardingFunction12();
    // pub fn NdrProxyForwardingFunction13();
    // pub fn NdrProxyForwardingFunction14();
    // pub fn NdrProxyForwardingFunction15();
    // pub fn NdrProxyForwardingFunction16();
    // pub fn NdrProxyForwardingFunction17();
    // pub fn NdrProxyForwardingFunction18();
    // pub fn NdrProxyForwardingFunction19();
    // pub fn NdrProxyForwardingFunction20();
    // pub fn NdrProxyForwardingFunction21();
    // pub fn NdrProxyForwardingFunction22();
    // pub fn NdrProxyForwardingFunction23();
    // pub fn NdrProxyForwardingFunction24();
    // pub fn NdrProxyForwardingFunction25();
    // pub fn NdrProxyForwardingFunction26();
    // pub fn NdrProxyForwardingFunction27();
    // pub fn NdrProxyForwardingFunction28();
    // pub fn NdrProxyForwardingFunction29();
}
