# Assets Directory

## Imposter Logo

**Location:** `assets/imposter-logo.png`

**Required:** The cyberpunk imposter mask logo image with blue gradient and white eyes needs to be saved in this directory.

### How to Add the Logo

1. Download or save the imposter logo image
2. Place it in this `assets/` directory
3. Name it: `imposter-logo.png` (or update HTML references if using different filename)

### Current Usage

The logo is referenced in:
- `html/play.html` - favicon (head section)
- `index.html` - favicon (head section)

### Add to HTML

To add favicon references, include in the `<head>` section:

```html
<link rel="icon" type="image/png" href="assets/imposter-logo.png">
```

Or for various sizes and formats:

```html
<link rel="icon" type="image/png" href="assets/imposter-logo.png" sizes="512x512">
<link rel="apple-touch-icon" href="assets/imposter-logo.png">
```

### Image Specifications

- **Format:** PNG (recommended for transparency)
- **Minimum Size:** 512x512 pixels
- **Colors:** Blue gradient theme with white/light accents
- **Style:** Cyber/tech-themed imposter mask
