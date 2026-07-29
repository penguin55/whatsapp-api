/**
 * OpenAPI 3.0 Configuration
 */
import { SwaggerOptions } from '@fastify/swagger';

// OpenAPI 3.0 configuration for Fastify Swagger
export const swaggerConfig: SwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'VenusConnect - WhatsApp API Gateway',
      description: `# WhatsApp Multi-Device API Gateway

REST API untuk mengirim dan menerima pesan WhatsApp.

## 🔐 Authentication
\`\`\`
x-api-key: your-api-key-here
\`\`\`

## ⏱️ Rate Limiting

- **100 requests/minute** per IP
- Jika limit terlampaui, response akan error 429

## 📎 Media Support

Media dapat dikirim dalam 3 format:
- **URL**: \`https://example.com/image.jpg\`
- **Local Path**: \`/path/to/file.pdf\`
- **Base64**: \`data:image/jpeg;base64,/9j/4AAQ...\`

## 🔔 Webhook Events

Jika webhook URL dikonfigurasi, events berikut akan dikirim:
- \`message.received\` - Pesan masuk
- \`message.status\` - Status pesan (sent/delivered/read)
- \`presence.update\` - Online/offline/typing

`,
      version: '2.0.0',
      contact: {
        name: 'VenusConnect Support',
        email: 'contact@venusverse.dev',
        url: 'https://whatsapp.venusverse.me',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    externalDocs: {
      url: 'https://whatsapp.venusverse.me/docs',
      description: 'Full Documentation',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
      { url: 'https://whatsapp.venusverse.me', description: 'Production' },
    ],
    tags: [
      { name: 'Auth', description: 'Public authentication (no API key required)' },
      { name: 'Session', description: 'WhatsApp session management' },
      { name: 'Messaging', description: 'Send messages (text, media, group, broadcast)' },
      { name: 'Scheduled', description: 'Scheduled message management' },
      { name: 'Groups', description: 'WhatsApp group management' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          name: 'x-api-key',
          in: 'header',
          description: 'API key for authentication. Get your API key by registering at /api/auth/register',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
};

export default { swaggerConfig };
