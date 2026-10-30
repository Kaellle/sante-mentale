# Publie une version de Santé Mentale sur GitHub (à lancer seulement quand Jordan le demande).
# Usage : .\release.ps1 1.1.6 "Ce qui change"
# Étapes : version dans module.json -> commit -> tag vX.Y.Z -> push -> release avec sante-mentale.zip ET module.json.
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Notes = ""
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version attendue au format X.Y.Z (reçu : $Version)" }
$tag = "v$Version"

# Arbre propre (les fichiers non suivis comme ce script sont tolérés) et branche main
if (git status --porcelain --untracked-files=no) { throw "Des modifications ne sont pas commitées : commiter d'abord." }
if ((git rev-parse --abbrev-ref HEAD) -ne "main") { throw "Pas sur la branche main." }
if (git tag --list $tag) { throw "Le tag $tag existe déjà." }

# Version dans module.json, sans toucher au reste de la mise en forme (UTF-8 sans BOM, que Foundry lit sans souci)
$manifest = Join-Path $PSScriptRoot "module.json"
$json = [IO.File]::ReadAllText($manifest)
$current = ([regex]'"version":\s*"([^"]+)"').Match($json).Groups[1].Value
if ([version]$Version -le [version]$current) { throw "$Version n'est pas plus récente que $current." }
$json = ([regex]'"version":\s*"[^"]+"').Replace($json, "`"version`": `"$Version`"", 1)
[IO.File]::WriteAllText($manifest, $json, (New-Object Text.UTF8Encoding($false)))

git add module.json
git commit -m "Version $Version"
git tag $tag
git push origin main
git push origin $tag

# Le zip contient le dossier sante-mentale/ à sa racine, et seulement ce que Foundry charge
$out = Join-Path $env:TEMP "sante-mentale-$Version"
New-Item -ItemType Directory -Force $out | Out-Null
$zip = Join-Path $out "sante-mentale.zip"
git archive --format zip --prefix sante-mentale/ -o $zip HEAD module.json scripts styles

if (-not $Notes) { $Notes = "Version $Version" }
gh release create $tag $zip $manifest --title $tag --notes $Notes
Write-Host "Release $tag publiée : https://github.com/Kaellle/sante-mentale/releases/tag/$tag"
