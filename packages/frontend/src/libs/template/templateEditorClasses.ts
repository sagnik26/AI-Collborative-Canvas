import styles from '../../components/TemplateEditorShell.module.css';
import type { TemplateTheme } from '../../types/template';

export function pageClassForTheme(theme: TemplateTheme): string | undefined {
  switch (theme) {
    case 'landing-dark':
      return styles.pageThemeLanding;
    case 'pitch-dark':
      return styles.pageThemePitchDark;
    case 'pitch-light':
      return styles.pageThemePitchLight;
    case 'pitch-zen':
      return styles.pageThemePitchZen;
    case 'pitch-neon':
      return styles.pageThemePitchNeon;
    default:
      return styles.pageThemeLanding;
  }
}

/** Preview article structure varies by pack so layouts read differently from each other. */
export function layoutClassForTemplateId(templateId: string): string {
  switch (templateId) {
    case 'pitch.v1':
      return styles.layoutPitchNarrative;
    case 'pitch.v2':
      return styles.layoutPitchMetrics;
    case 'pitch.v3':
      return styles.layoutPitchZen;
    case 'pitch.v4':
      return styles.layoutPitchNeon;
    case 'landing.v1':
    default:
      return styles.layoutLanding;
  }
}

