# Resumen de Prensa v2

Aplicación web progresiva (PWA) para confeccionar informes:

- `*RESUMEN DE PRENSA AM DD/MM/AAAA*`
- `*RESUMEN DE PRENSA PM DD/MM/AAAA*`

## Horarios
- AM: 17:15 del día anterior → 08:15 del día del informe.
- PM: 08:15 → 17:15 del día del informe.

## Categorías
- CONTINGENCIA NACIONAL
- CONTINGENCIA REGIONAL
- CONTINGENCIA POLICIAL

## Incluye
- Revisión de noticias.
- Filtro por categoría.
- Relevancia alta/media/baja.
- Validación de rango horario.
- Generación en formato WhatsApp.
- Compartir desde Android.
- Historial.
- Respaldo/restauración.
- Instalación como PWA.

## Búsqueda automática
La interfaz ya incluye `Buscar noticias`. Para activarla se debe configurar
`newsApiEndpoint` en `config.js`. Ese endpoint debe responder JSON:

{
  "news": [
    {
      "title": "...",
      "source": "...",
      "published": "2026-09-08T12:30:00-03:00",
      "url": "https://...",
      "summary": "...",
      "category": "national|regional|police",
      "relevance": "high|medium|low",
      "included": true
    }
  ]
}

La PWA está lista para GitHub Pages o cualquier hosting HTTPS.
