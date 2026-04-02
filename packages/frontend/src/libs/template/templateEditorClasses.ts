import styles from '../../components/TemplateEditorShell.module.css';
import type { TemplateTheme } from '../../types/template';

export function pageClassForTheme(theme: TemplateTheme): string | undefined {
  switch (theme) {
    case 'landing-dark':
      return styles.pageThemeLanding;
    default:
      return styles.pageThemeLanding;
  }
}

/** Preview article structure varies by pack so layouts read differently from each other. */
export function layoutClassForTemplateId(templateId: string): string {
  switch (templateId) {
    case 'landing.v1':
    default:
      return styles.layoutLanding;
  }
}

