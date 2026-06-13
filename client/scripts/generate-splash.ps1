# Generates iOS splash screens (apple-touch-startup-image) from the app icon.
# Run from the client/ directory:  powershell -File scripts/generate-splash.ps1

Add-Type -AssemblyName System.Drawing

$iconPath = Join-Path $PSScriptRoot "..\public\icons\icon-512x512-v2.png"
$outDir = Join-Path $PSScriptRoot "..\public\splash"
New-Item -ItemType Directory -Force $outDir | Out-Null

# Portrait pixel sizes for modern iPhones (logical size x device pixel ratio)
$sizes = @(
    @(640, 1136),   # iPhone SE 1st gen (320x568 @2x)
    @(750, 1334),   # iPhone 8 / SE 2-3 (375x667 @2x)
    @(828, 1792),   # iPhone XR / 11 (414x896 @2x)
    @(1125, 2436),  # iPhone X / XS / 11 Pro / 12-13 mini (375x812 @3x)
    @(1170, 2532),  # iPhone 12 / 13 / 14 (390x844 @3x)
    @(1179, 2556),  # iPhone 14 Pro / 15 / 16 (393x852 @3x)
    @(1206, 2622),  # iPhone 16 Pro (402x874 @3x)
    @(1242, 2208),  # iPhone 6+ / 7+ / 8+ (414x736 @3x)
    @(1242, 2688),  # iPhone XS Max / 11 Pro Max (414x896 @3x)
    @(1284, 2778),  # iPhone 12-13 Pro Max / 14 Plus (428x926 @3x)
    @(1290, 2796),  # iPhone 14 Pro Max / 15 Plus-Pro Max / 16 Plus (430x932 @3x)
    @(1320, 2868)   # iPhone 16 Pro Max (440x956 @3x)
)

$icon = [System.Drawing.Image]::FromFile((Resolve-Path $iconPath))

foreach ($size in $sizes) {
    $w = $size[0]; $h = $size[1]
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)

    # Icon at 30% of screen width, centered
    $iconW = [int]($w * 0.3)
    $x = [int](($w - $iconW) / 2)
    $y = [int](($h - $iconW) / 2)
    $g.DrawImage($icon, $x, $y, $iconW, $iconW)

    $outPath = Join-Path $outDir "splash-${w}x${h}.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "created splash-${w}x${h}.png"
}

$icon.Dispose()
