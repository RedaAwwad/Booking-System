import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';

const TraceURL = `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`

const traceExporter = new OTLPTraceExporter({
    url: TraceURL,
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
console.log('OpenTelemetry SDK started, Trace exporter url:', TraceURL);