# Bật / tắt / xem "Tự chạy khi mở máy" của MOZA Live OS (SPEC.md F-01).
# Chỉ chạy khi người dùng bấm nút trong màn hình Cài đặt — phần mềm không tự bật.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tu-chay.ps1 -Lenh xem|bat|tat
#
# Cách 1: Task Scheduler, chạy khi tài khoản này đăng nhập. Không dừng khi chạy pin, không giới hạn
#         thời gian chạy (mặc định Windows dừng tác vụ sau 72 giờ — không hợp với máy bật 24/7).
# Cách 2: nếu Windows không cho tạo tác vụ (có máy đòi quyền quản trị), đặt lối tắt vào thư mục
#         Startup của tài khoản — không cần quyền quản trị.
# Không đụng tới cài đặt nguồn điện hay bất kỳ cài đặt hệ thống nào khác.

param([ValidateSet('xem', 'bat', 'tat')][string]$Lenh = 'xem')

$ErrorActionPreference = 'Stop'
$ten = 'MOZA Live OS'
$goc = Split-Path -Parent $PSScriptRoot
$bat = Join-Path $goc 'scripts\start.bat'
$loiTat = Join-Path ([Environment]::GetFolderPath('Startup')) 'MOZA Live OS.lnk'
$nguoi = "$env:USERDOMAIN\$env:USERNAME"

function CoTacVu { return [bool](Get-ScheduledTask -TaskName $ten -ErrorAction SilentlyContinue) }

switch ($Lenh) {
  'xem' {
    if (CoTacVu) { 'dang-bat:task' } elseif (Test-Path $loiTat) { 'dang-bat:startup' } else { 'dang-tat' }
  }
  'bat' {
    try {
      # start /min: cửa sổ đen thu nhỏ; --nen: không tự mở trình duyệt mỗi lần đăng nhập.
      $hanhDong = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c start `"MOZA Live OS`" /min `"$bat`" --nen" -WorkingDirectory $goc
      $kichHoat = New-ScheduledTaskTrigger -AtLogOn -User $nguoi
      $caiDat = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -MultipleInstances IgnoreNew
      $chuThe = New-ScheduledTaskPrincipal -UserId $nguoi -LogonType Interactive -RunLevel Limited
      Register-ScheduledTask -TaskName $ten -Action $hanhDong -Trigger $kichHoat -Settings $caiDat -Principal $chuThe -Force | Out-Null
      if (Test-Path $loiTat) { Remove-Item $loiTat -Force }
      'da-bat:task'
    } catch {
      $sh = New-Object -ComObject WScript.Shell
      $lt = $sh.CreateShortcut($loiTat)
      $lt.TargetPath = $bat
      $lt.Arguments = '--nen'
      $lt.WorkingDirectory = $goc
      $lt.WindowStyle = 7   # thu nhỏ
      $lt.Save()
      'da-bat:startup'
    }
  }
  'tat' {
    if (CoTacVu) { Unregister-ScheduledTask -TaskName $ten -Confirm:$false }
    if (Test-Path $loiTat) { Remove-Item $loiTat -Force }
    'da-tat'
  }
}
