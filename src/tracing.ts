import { NodeSDK } from '@opentelemetry/sdk-node';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';

const zipkinUrl = process.env.ZIPKIN_URL || 'http://localhost:9411/api/v2/spans';

const traceExporter = new ZipkinExporter({
  url: zipkinUrl,
});

export const otelSDK = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'booking-api',
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

// Gracefully shut down SDK on process exit
process.on('SIGTERM', () => {
  otelSDK.shutdown()
    .then(() => console.log('SDK shut down successfully'))
    .catch((err) => console.log('Error shutting down SDK', err))
    .finally(() => process.exit(0));
});

// Initialize SDK
otelSDK.start();
console.log('OpenTelemetry SDK started, Zipkin exporter url:', zipkinUrl);
