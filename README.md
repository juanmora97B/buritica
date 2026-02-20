# 🐷 Buritica - Sistema de Gestión Porcina

Sistema integral para la administración de granjas porcinas, control de inventario, ventas y finanzas.

## 📋 Características

- **Gestión de Cerdos**: Control completo del inventario de cerdos (vivos, vendidos, muertos)
- **Control de Ventas**: Registro de ventas en pie, canal y libriado
- **Gestión de Gastos**: Seguimiento de gastos generales y por cerdo
- **Administración de Clientes**: Control de clientes, límites de crédito y estados de cuenta
- **Sistema de Fiados**: Gestión de créditos y abonos
- **Reportes Financieros**: Resumen diario automático de ventas, gastos y ganancias
- **Historial de Movimientos**: Trazabilidad completa de cambios en cerdos
- **Etiquetas**: Sistema de etiquetado para mejor organización

## 🚀 Tecnologías

- **Frontend**: React 19 + Vite
- **Estilos**: Tailwind CSS 4
- **Base de Datos**: Supabase (PostgreSQL)
- **Routing**: React Router DOM 7
- **Gráficos**: Recharts
- **Autenticación**: Supabase Auth

## 📦 Instalación

### Requisitos previos
- Node.js 18+ 
- npm o yarn
- Cuenta de Supabase

### Pasos de instalación

1. **Clonar el repositorio**
```bash
git clone <url-del-repositorio>
cd buritica
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crear archivo `.env` en la raíz del proyecto:
```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

4. **Configurar la base de datos**

Ejecutar los scripts SQL en Supabase (en orden):
- Crear tablas (ver estructura en documentación de Supabase)
- Ejecutar `SQL_TRIGGERS_RESUMEN_DIARIO.sql` para triggers y funciones

5. **Iniciar el servidor de desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🛠️ Scripts disponibles

```bash
npm run dev      # Inicia servidor de desarrollo
npm run build    # Crea build de producción
npm run preview  # Preview del build de producción
npm run lint     # Ejecuta ESLint
```

## 📁 Estructura del proyecto

```
buritica/
├── public/              # Archivos estáticos
├── src/
│   ├── assets/         # Imágenes y recursos
│   ├── components/     # Componentes reutilizables
│   ├── context/        # Contextos de React
│   ├── hooks/          # Custom hooks
│   ├── layout/         # Componentes de layout
│   ├── lib/            # Configuraciones (Supabase)
│   ├── pages/          # Páginas principales
│   │   ├── Cerdos.jsx
│   │   ├── Ventas.jsx
│   │   ├── NuevaVenta.jsx
│   │   ├── Gastos.jsx
│   │   ├── Clientes.jsx
│   │   ├── Fiados.jsx
│   │   └── Dashboard.jsx
│   ├── services/       # Servicios y API calls
│   ├── utils/          # Utilidades y helpers
│   ├── App.jsx         # Componente principal
│   └── main.jsx        # Punto de entrada
└── package.json
```

## 💾 Base de Datos

### Tablas principales:
- `cerdos`: Inventario de cerdos
- `ventas`: Registro de ventas
- `detalle_venta`: Detalles de productos vendidos
- `ventas_libriado`: Ventas por libra a múltiples clientes
- `gastos`: Gastos generales y por cerdo
- `clientes`: Base de datos de clientes
- `pagos`: Registro de pagos y abonos
- `movimientos_cerdos`: Historial de cambios
- `etiquetas_cerdos`: Sistema de etiquetado
- `resumen_financiero_diario`: Resumen automático diario

### Triggers automáticos:
- Actualización de resumen financiero al crear/editar ventas
- Actualización de resumen financiero al crear/editar gastos
- Actualización de resumen financiero al crear/editar pagos
- Actualización automática al cambiar estado de cerdos

## 🔒 Seguridad

- Row Level Security (RLS) activo en Supabase
- Autenticación requerida para todas las operaciones
- Variables de entorno para credenciales sensibles
- Validación de datos en cliente y servidor

## 📱 Responsive Design

La aplicación está optimizada para:
- 💻 Desktop (1024px+)
- 📱 Tablet (768px - 1023px)
- 📱 Mobile (< 768px)

## 🎨 Funcionalidades destacadas

### Formateo de números
Todos los campos numéricos usan separadores de miles (punto):
- Entrada: `200000` → Display: `200.000`
- Sin decimales para valores enteros

### Cálculos automáticos
- Utilidad por cerdo: `Venta - Costo compra - Gastos`
- Deuda de clientes: `Total venta - Pagos realizados`
- Cambio en ventas: `Monto pagado - Total venta`

### Filtros avanzados
- Gastos: Por mes, categoría y cerdo
- Ventas: Por estado y tipo
- Clientes: Por deuda activa

## 🚀 Despliegue

### Vercel (Recomendado)
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

**Importante**: Configurar las variables de entorno en la plataforma de hosting.

## 👥 Uso

1. **Agregar Cerdo**: Registrar nuevo cerdo con peso, código y costo
2. **Registrar Gastos**: Asociar gastos generales o por cerdo específico
3. **Crear Venta**: 
   - Pie: Venta completa del cerdo vivo
   - Canal: Venta del cerdo procesado
   - Libriado: Venta por libras a múltiples clientes
4. **Gestionar Clientes**: Crear clientes, asignar límites de crédito
5. **Control de Fiados**: Registrar abonos a cuentas pendientes
6. **Ver Dashboard**: Resumen financiero y métricas clave

## 📈 Mejoras futuras

- [ ] Exportar reportes a Excel/PDF
- [ ] Gráficos de tendencias
- [ ] Notificaciones push
- [ ] Modo offline
- [ ] App móvil nativa
- [ ] Sistema de roles y permisos
- [ ] Integración con WhatsApp para notificaciones

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.

## 📞 Soporte

Para soporte o consultas, contactar al equipo de desarrollo.

---

**Desarrollado con ❤️ para la gestión eficiente de granjas porcinas**

