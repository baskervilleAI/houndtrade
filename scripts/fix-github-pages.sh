#!/bin/bash

# Script para ajustar paths de GitHub Pages después del build
echo "🔧 Ajustando paths para GitHub Pages..."

# Cambiar directorio al dist
cd /home/david/houndtrade/dist

# Reemplazar paths absolutos con paths relativos en index.html
sed -i 's|href="/favicon.ico"|href="./favicon.ico"|g' index.html
sed -i 's|src="/_expo/|src="./_expo/|g' index.html

# Crear archivo .nojekyll para evitar que GitHub Pages procese como Jekyll
touch .nojekyll

echo "✅ Paths ajustados para GitHub Pages"
echo "📁 Contenido de dist:"
ls -la

echo "🎯 Listo para deploy!"
