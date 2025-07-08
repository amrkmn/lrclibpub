# LRCLIBpub

A modern static web interface for publishing lyrics to the LRCLIB database. Built with Svelte and TailwindCSS.

<img width="1552" alt="image" src="https://github.com/user-attachments/assets/f8a176e3-029e-44a8-909c-c23e6180fdd0" />


## Features

- Clean, user-friendly interface for submitting lyrics
- Support for both plain and synced (LRC) lyrics
- LRC file upload and parsing
- Proof-of-work challenge system to prevent spam
- Real-time submission progress tracking
- Form validation and error handling
- Responsive design
- **Static site generation** - no server required

## Technical Details

### Stack

- Svelte + TypeScript (Static Site Generation)
- TailwindCSS for styling
- Web Workers for proof-of-work computation
- Zig WebAssembly for proof-of-work challenge generation
- Direct LRCLIB API integration (client-side only)

### Key Components

#### Form Data

The application handles the following data fields:

- Track Name (required)
- Artist Name (required)
- Album Name (optional)
- Duration in seconds (optional)
- Plain Lyrics
- Synced Lyrics (LRC format)

A user can either fill in the fields manually or upload an LRC file to auto-fill the form.

#### Proof of Work System

- Implements a challenge-response mechanism
- Uses Web Workers for background computation
- Real-time progress tracking with hash rate display

#### File Handling

- Supports .lrc file uploads
- Automatic parsing of LRC metadata and lyrics
- Auto-fills form fields from LRC metadata

### API Integration

Integrates directly with LRCLIB API endpoints (client-side):

- `https://lrclib.net/api/request-challenge` - Gets proof-of-work challenge
- `https://lrclib.net/api/publish` - Publishes lyrics with solved challenge token

## Deployment

This is a static site that can be deployed to any static hosting provider:

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **Cloudflare Pages**
- **Any web server** (Apache, Nginx, etc.)

Simply build the project and serve the `build` directory.

## Usage

1. Fill in the required track and artist information
2. Add lyrics either by:
   - Pasting plain lyrics
   - Pasting synced lyrics in LRC format
   - Uploading an LRC file
3. Click "Publish Lyrics" to submit
4. Wait for the proof-of-work challenge to complete

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production (static site)
npm run build

# Preview production build
npm run preview
```

## Building for Production

The build process creates a static site in the `build` directory:

1. **Build WASM module**: `npm run build:wasm`
2. **Build static site**: `npm run build`
3. **Deploy**: Upload the `build` directory to your hosting provider

## Notes

- Publishing requires solving a proof-of-work challenge which may take several minutes
- Both lyrics fields can be left empty for instrumental tracks
- The interface provides real-time feedback during the publishing process
- Form data is validated before submission

## License

GPL-3.0 License

## Credits

Powered by [BetterLyrics](https://better-lyrics.boidu.dev) - A browser extension for enhanced lyrics display on YouTube Music.
