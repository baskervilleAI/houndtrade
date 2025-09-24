#!/bin/bash

# Script para hacer deploy limpio a GitHub Pages
echo "🚀 Iniciando deploy limpio a GitHub Pages..."

# Guardar el directorio actual
ORIGINAL_DIR=$(pwd)
BUILD_DIR="$ORIGINAL_DIR/dist"

# Verificar que existe el directorio dist
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Error: No existe el directorio dist. Ejecuta 'npm run build:web' primero."
    exit 1
fi

# Crear un directorio temporal
TEMP_DIR=$(mktemp -d)
echo "📁 Directorio temporal: $TEMP_DIR"

# Copiar archivos del build al directorio temporal
cp -r "$BUILD_DIR"/* "$TEMP_DIR/"
cp -r "$BUILD_DIR"/.nojekyll "$TEMP_DIR/" 2>/dev/null || true

# Cambiar al directorio temporal
cd "$TEMP_DIR"

# Inicializar un nuevo repositorio git
git init
git add .
git commit -m "Deploy to GitHub Pages"

# Configurar el remote
git remote add origin "git@github.com-baskerville:baskervilleAI/houndtrade.git"

# Hacer push forzado a gh-pages
git push --force origin master:gh-pages

# Limpiar
cd "$ORIGINAL_DIR"
rm -rf "$TEMP_DIR"

echo "✅ Deploy completado exitosamente!"
echo "🌐 Tu sitio estará disponible en: https://baskervilleAI.github.io/houndtrade"
