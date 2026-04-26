import { ImageResponse } from 'next/og'

export const alt =
  'Segunda Opinião — Uma segunda opinião médica baseada em ciência.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px',
          color: '#0F172A',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -2,
            display: 'flex',
            gap: 16,
          }}
        >
          <span>Segunda</span>
          <span style={{ color: '#0284C7' }}>Opinião</span>
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 36,
            color: '#475569',
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          Uma segunda opinião médica em minutos, baseada em evidências
          científicas.
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 64,
            right: 64,
            height: 6,
            background: '#0284C7',
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
