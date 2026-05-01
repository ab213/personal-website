# Google Analytics Setup

This site uses a shared Google Analytics 4 loader across all pages.

## 1. Get your GA4 measurement ID

In Google Analytics:

1. Go to `Admin`.
2. Under `Data collection and modification`, open `Data streams`.
3. Select your website stream.
4. Copy the `Measurement ID`.

The measurement ID starts with `G-`.

## 2. Add it to the site

Open `analytics-config.js` and fill in:

```js
window.ANALYTICS_CONFIG = {
    gaMeasurementId: "G-XXXXXXXXXX",
    debug: false
};
```

## 3. Publish

Commit and push:

- `analytics-config.js`
- `js/analytics.js`
- updated HTML pages

## 4. Verify

After deployment:

1. Visit the live site.
2. In Google Analytics, open `Reports` or `Realtime`.
3. You should start seeing page views after data begins flowing.

Google notes that data collection can take some time to appear in reports, while Realtime should update much sooner.
