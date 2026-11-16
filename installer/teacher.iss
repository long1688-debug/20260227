; Inno Setup 6 脚本：打包 Release 版教师端 + runtime 依赖
; 先执行:
;   powershell -ExecutionPolicy Bypass -File scripts\prepare-runtime.ps1 -ZLMediaKitDir <ZLMediaKit 目录>
;   cd tauri-app && npm run tauri build
; 再用 ISCC.exe installer\teacher.iss 编译

#define AppName "实训教学系统 - 教师端"
#define AppVersion "2.0.0"
#define AppExe "training-teaching-system.exe"
#define SrcTauri "..\tauri-app\src-tauri"

[Setup]
AppId={{6F1C2B8E-7D41-4C1B-9E3A-2B5D8F0A4C17}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\TrainingTeacher
DefaultGroupName={#AppName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2/max
SolidCompression=yes
OutputDir=Output
OutputBaseFilename=TrainingTeacher-Setup-{#AppVersion}
SetupIconFile={#SrcTauri}\icons\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
PrivilegesRequired=admin

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; 只打包 Release 产物（Debug 版未优化，会慢数倍）
Source: "{#SrcTauri}\target\release\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
; ort 默认静态链接 ONNX Runtime；若改为动态链接，onnxruntime*.dll 会出现在 release 目录，这里一并打包
Source: "{#SrcTauri}\target\release\onnxruntime*.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#SrcTauri}\resources\runtime\*"; DestDir: "{app}\runtime"; Excludes: "README.md,MicrosoftEdgeWebview2Setup.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SrcTauri}\resources\runtime\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NeedsWebView2
; 若启用了 mpv feature，取消下一行注释
; Source: "..\mpv\mpv-2.dll"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "正在安装 WebView2 运行时..."; Check: NeedsWebView2; Flags: waituntilterminated
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Code]
const
  WebView2Key = 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2UserKey = 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function NeedsWebView2(): Boolean;
var
  Version: String;
begin
  Result := not (
    (RegQueryStringValue(HKLM, WebView2Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')) or
    (RegQueryStringValue(HKCU, WebView2UserKey, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')));
end;
