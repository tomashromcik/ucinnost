
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
plugins: [react()],
// `base` nastaví workflow při buildu, takže tady výchozí hodnotu necháme prázdnou
})

