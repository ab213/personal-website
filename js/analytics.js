(function () {
    const config = window.ANALYTICS_CONFIG || {};
    const measurementId = (config.gaMeasurementId || "").trim();

    if (!measurementId) {
        return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];

    window.gtag = function () {
        window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
        debug_mode: Boolean(config.debug)
    });
})();
