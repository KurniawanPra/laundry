import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LaundryPOS - Kasir & Tracking Cucian',
    short_name: 'LaundryPOS',
    description: 'Kasir dan pelacakan pesanan laundry.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0891b2',
    lang: 'id-ID',
    icons: [
      {
        src: '/laundry-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
