/**
 * Project Indexer (Minimal - No Cheerio)
 * 
 * Stores HTML sections as strings in Firestore.
 * Per newlogic.md: No complex parsing, just section extraction via regex.
 */

import * as admin from 'firebase-admin';
import { ProjectIndex, ComponentSection } from './types';

const getDb = () => admin.firestore();

// ============================================================================
// MINIMAL INDEXER (Regex-based section extraction)
// ============================================================================

export async function buildProjectIndex(
  html: string,
  projectId: string
): Promise<ProjectIndex> {
  const components: Record<string, ComponentSection> = {};
  
  // Extract common sections using simple regex (no parsing)
  const sections = [
    { name: 'Navbar', regex: /<nav[\s\S]*?<\/nav>/i },
    { name: 'Hero', regex: /<section[^>]*class="[^"]*hero[^"]*"[^>]*>[\s\S]*?<\/section>/i },
    { name: 'Footer', regex: /<footer[\s\S]*?<\/footer>/i },
  ];

  for (const section of sections) {
    const match = html.match(section.regex);
    if (match) {
      components[section.name] = {
        name: section.name,
        html: match[0],
      };
    }
  }

  const styleSystem = html.includes('tailwindcss') || html.includes('class="') ? 'tailwind' : 'css';

  return {
    projectId,
    html,
    components,
    styleSystem,
    lastIndexedAt: new Date().toISOString(),
  };
}

export async function saveProjectIndex(index: ProjectIndex): Promise<void> {
  await getDb()
    .collection('projects')
    .doc(index.projectId)
    .collection('vibe')
    .doc('index')
    .set(index);
}

export async function getProjectIndex(projectId: string): Promise<ProjectIndex | null> {
  const doc = await getDb()
    .collection('projects')
    .doc(projectId)
    .collection('vibe')
    .doc('index')
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as ProjectIndex;
}
