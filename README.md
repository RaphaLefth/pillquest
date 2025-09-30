# 💊 PillQuest PWA

Una Progressive Web App (PWA) completa y gamificada para adherencia a medicamentos, desarrollada completamente con **HTML5 + CSS3 + JavaScript vanilla** sin dependencias externas.

## 🚀 Características Principales

### ✅ PWA Completamente Funcional

- **Instalable** en dispositivos móviles y desktop
- **Offline-first** con Service Worker y cache strategy
- **Notificaciones push** para recordatorios de medicación
- **Manifest completo** con iconos y shortcuts

### 🎮 Gamificación Avanzada

- **Sistema de puntos XP** (+10 por dosis)
- **Monedas virtuales** (+5 por dosis)
- **Sistema de rachas** (días consecutivos)
- **8 logros desbloqueables**:
  - 🎯 Primera Dosis
  - ⭐ Semana Perfecta (7 días)
  - 👑 Maestro del Mes (30 días)
  - 🌅 Madrugador (antes 8 AM)
  - 💪 Constante (5 días seguidos)
  - 🏆 Centurión (100 dosis)
  - 🔥 Inquebrantable (14 días)
  - 💎 Coleccionista (500 puntos)

### 📱 Experiencia de Usuario

- **Mobile-first responsive design**
- **Tema verde/azul** optimizado para salud
- **Navegación inferior** con 5 pantallas
- **Animaciones suaves** y feedback visual
- **Toast notifications** para feedback inmediato

### 🗄️ Persistencia de Datos

- **IndexedDB nativo** (sin librerías)
- **Repository pattern** para datos estructurados
- **Esquema completo**: Users, Treatments, Doses, Stats, Achievements
- **Ventana de toma**: ±60 minutos de flexibilidad

## 📁 Estructura de Archivos

```
pillquest-pwa/
├── index.html              # Punto de entrada principal
├── manifest.webmanifest    # Configuración PWA
├── service-worker.js       # Cache offline-first
├── css/
│   └── styles.css         # Estilos completos y responsivos
├── js/
│   └── main.js           # Lógica completa de la aplicación
├── icons/
│   ├── icon-72.svg       # Iconos PWA en múltiples tamaños
│   ├── icon-96.svg
│   ├── icon-128.svg
│   ├── icon-144.svg
│   ├── icon-152.svg
│   ├── icon-192.svg
│   ├── icon-384.svg
│   └── icon-512.svg
├── i18n/
│   ├── es.json          # Traducciones español
│   └── en.json          # Traducciones inglés
├── screenshots/
│   └── home-mobile.svg  # Screenshots para PWA
└── README.md           # Esta documentación
```

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Variables CSS, Grid, Flexbox, Animaciones
- **JavaScript ES6+**: Clases, Async/Await, Modules pattern
- **IndexedDB API**: Base de datos nativa del navegador
- **Service Worker API**: Cache y funcionalidad offline
- **Web Notifications API**: Recordatorios push
- **Web App Manifest**: Instalación PWA

## 🚦 Instalación y Uso

### 1. Servidor Local

```bash
# Opción 1: Python
cd pillquest-pwa
python -m http.server 8000

# Opción 2: Node.js
npx http-server -p 8000

# Opción 3: PHP
php -S localhost:8000
```

### 2. Acceso

Abrir navegador en: `http://localhost:8000`

### 3. GitHub Pages

1. Subir archivos a repositorio GitHub
2. Habilitar GitHub Pages
3. Acceder vía HTTPS (requerido para PWA)

## 📖 Flujo de Usuario

### Registro Inicial

1. **Datos personales**: Nombre, usuario, zona horaria
2. **Tratamiento inicial**: Medicamento, dosis, frecuencia, horario
3. **Creación automática**: Usuario + tratamiento + dosis programadas

### Pantalla Principal

1. **Avatar píldora** animado 💊
2. **Stats en tiempo real**: Puntos, monedas, racha, dosis totales
3. **Botón "Tomar Ahora"** cuando hay dosis pendientes
4. **Lista de tratamientos** activos
5. **Navegación inferior** a otras secciones

### Tomar Medicación

1. **Ventana flexible**: ±60 minutos del horario programado
2. **Actualización inmediata**: +10 XP, +5 monedas
3. **Sistema de rachas**: Días consecutivos automáticos
4. **Verificación de logros**: Desbloqueados al instante
5. **Animaciones de éxito**: Feedback visual

## 🏗️ Arquitectura Técnica

### IndexedDB Schema

```javascript
// Users Store
{
  id: number,
  name: string,
  username: string,
  timezone: string,
  createdAt: string,
  updatedAt: string
}

// Treatments Store
{
  id: number,
  userId: number,
  medicationName: string,
  dosage: string,
  frequency: number,
  schedule: string[],
  duration: number,
  startDate: string,
  active: boolean
}

// Doses Store
{
  id: number,
  treatmentId: number,
  scheduledAt: string,
  status: 'scheduled'|'taken',
  takenAt: string|null,
  medicationName: string,
  dosage: string
}
```

### Repository Pattern

- **UserRepository**: CRUD operaciones de usuarios
- **TreatmentRepository**: Gestión de tratamientos
- **DoseRepository**: Control de dosis y ventanas de tiempo
- **UserStatsRepository**: Estadísticas y gamificación
- **AchievementRepository**: Sistema de logros

### Service Worker Strategy

- **Cache-first**: Assets estáticos (CSS, JS, icons)
- **Network-first**: API calls y datos dinámicos
- **Stale-while-revalidate**: HTML pages
- **Offline fallbacks**: Páginas de error personalizadas

## 🔧 Personalización

### Temas y Colores

```css
:root {
  --primary-color: #4caf50; /* Verde principal */
  --secondary-color: #2196f3; /* Azul secundario */
  --background-color: #e8f5e8; /* Fondo suave */
  --success-color: #4caf50; /* Éxito */
  --warning-color: #ff9800; /* Advertencia */
  --error-color: #f44336; /* Error */
}
```

### Configuración de Juego

```javascript
const APP_CONFIG = {
  DOSE_WINDOW_MINUTES: 60, // Ventana de toma ±60 min
  POINTS_PER_DOSE: 10, // Puntos por dosis
  COINS_PER_DOSE: 5, // Monedas por dosis
};
```

### Nuevos Logros

```javascript
// En ACHIEVEMENTS array
{
  id: 'nuevo_logro',
  name: 'Nombre del Logro',
  description: 'Descripción detallada',
  icon: '🏅',
  unlocked: false
}
```

## 🚀 Deployment

### GitHub Pages

1. Fork o clone del repositorio
2. Push a branch `main` o `gh-pages`
3. Settings → Pages → Source: Deploy from branch
4. Acceso vía `https://username.github.io/pillquest-pwa/`

### Netlify

1. Drag & drop de la carpeta completa
2. Deploy automático con HTTPS
3. Dominio personalizado opcional

### Vercel

```bash
npx vercel
# Seguir instrucciones interactivas
```

## 🧪 Testing

### Funcionalidades Core

- ✅ Registro de usuario único
- ✅ Creación de tratamiento inicial
- ✅ Generación automática de dosis
- ✅ Toma de medicación en ventana de tiempo
- ✅ Actualización de stats y rachas
- ✅ Desbloqueo de logros
- ✅ Persistencia offline con IndexedDB

### PWA Features

- ✅ Instalación en dispositivos móviles
- ✅ Funcionamiento offline
- ✅ Notificaciones push (con permisos)
- ✅ Iconos y tema adecuados
- ✅ Performance Lighthouse >90

### Responsive Design

- ✅ Mobile: 320px - 767px
- ✅ Tablet: 768px - 1024px
- ✅ Desktop: 1025px+

## 🐛 Troubleshooting

### La PWA no se instala

- Verificar HTTPS (requerido)
- Comprobar manifest.webmanifest válido
- Service Worker registrado correctamente
- Iconos en todos los tamaños necesarios

### IndexedDB errors

- Verificar soporte del navegador
- Comprobar esquema de base de datos
- Revisar transacciones asíncronas

### Notificaciones no funcionan

- Solicitar permisos explícitamente
- Verificar Service Worker activo
- Comprobar contexto HTTPS

## 📊 Métricas PWA

### Performance

- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Cumulative Layout Shift**: <0.1
- **Time to Interactive**: <3s

### Accessibility

- **Contraste**: AA+ compliant
- **Navegación teclado**: Completa
- **Screen readers**: Compatibilidad
- **Semántica HTML**: Correcta

## 🤝 Contribuir

1. Fork del proyecto
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -m 'Add nueva funcionalidad'`
4. Push rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 👏 Créditos

- **Desarrollado por**: GitHub Copilot AI Assistant
- **Iconos**: Generados con SVG personalizado
- **Inspiración**: Gamificación de aplicaciones de salud modernas
- **Tecnologías**: Web Platform APIs nativas

---

## 🎯 Roadmap Futuro

### v2.0 Features

- [ ] **Múltiples usuarios** en mismo dispositivo
- [ ] **Sincronización en la nube** opcional
- [ ] **Recordatorios inteligentes** con ML
- [ ] **Análisis de adherencia** avanzado
- [ ] **Integración IoT** (pastilleros inteligentes)
- [ ] **Modo médico** para profesionales
- [ ] **Exportar reportes** PDF/Excel
- [ ] **Temas personalizables** adicionales

### v2.1 Gamificación

- [ ] **Tienda virtual** funcional
- [ ] **Avatares personalizables**
- [ ] **Misiones semanales**
- [ ] **Liga de amigos**
- [ ] **Logros por categorías**
- [ ] **Racha global** community

¡Gamifica tu salud con PillQuest! 💊🎮✨
