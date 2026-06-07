# Hairstyle Image Crawler

Downloads model hairstyle reference images from Wikimedia Commons and saves a
`metadata.jsonl` file with source and attribution data.

## Run

```powershell
.\run.ps1 -Count 30 -Output .\downloads
```

Or call Python directly:

```powershell
python .\hairstyle_crawler.py --count 30 --output .\downloads
```

## Useful Options

```powershell
python .\hairstyle_crawler.py --count 50 --output .\downloads --query "bob haircut portrait" --query "curly hairstyle portrait"
```

If Wikimedia Commons is rate-limited, use the fallback random image source:

```powershell
python .\hairstyle_crawler.py --source loremflickr --count 20 --output .\downloads --delay 1
```

Downloaded images are intended as reference/test material. Check
`metadata.jsonl` for each image's source URL, author, and license terms before
using them in production or marketing materials.
