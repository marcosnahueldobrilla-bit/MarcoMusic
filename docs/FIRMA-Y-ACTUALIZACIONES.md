# Firma y actualizaciones de MARCOMUSIC

- El botón genera un **APK de depuración** firmado con la clave debug que GitHub crea en cada compilación.
- Como esa clave cambia entre máquinas, Android puede rechazar instalar una versión nueva encima de la anterior ("conflicto de paquete"). En ese caso, desinstalá la versión vieja (tus canciones del celular no se borran, solo la biblioteca indexada).

## Para versiones de distribución (actualizables sin desinstalar)
1. Crear una clave una sola vez: `keytool -genkey -v -keystore marcomusic.jks -alias marcomusic -keyalg RSA -keysize 2048 -validity 10000`.
2. Guardarla en GitHub → Settings → Secrets → Actions como `ANDROID_KEYSTORE_BASE64` (archivo en base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. Agregar al workflow un paso `./gradlew assembleRelease` con `signingConfigs` que lea esos secretos.
4. Nunca subir la clave `.jks` ni sus contraseñas al repositorio. Si se pierde, no se podrán publicar actualizaciones con la misma firma.

El `versionCode` aumenta solo en cada compilación (número de ejecución de GitHub).
