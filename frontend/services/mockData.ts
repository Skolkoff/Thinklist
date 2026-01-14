
import { Article, Collection, UserProfile } from '../types';

export const AVAILABLE_TAGS = [
  'Machine Learning', 'Quantum Physics', 'Bioinformatics', 
  'Neuroscience', 'Climate Change', 'Blockchain', 
  'Astrophysics', 'CRISPR', 'Robotics', 'Materials Science',
  'Law', 'History', 'Psychology'
];

export const MOCK_USER: UserProfile = {
  id: 'u1',
  name: 'Alex Scientist',
  nickname: 'alex_sci',
  avatarUrl: 'https://picsum.photos/seed/user/200/200',
  workplace: 'MIT Media Lab',
  fieldOfStudy: 'Computer Science',
  bio: 'Passionate about AI ethics and machine learning applications in healthcare. Building the future of scientific discovery.',
  interests: ['Machine Learning', 'Bioinformatics']
};

export const MOCK_OTHER_USER: UserProfile = {
  id: 'u2',
  name: 'Sarah Researcher',
  nickname: 'sarah_phd',
  avatarUrl: 'https://picsum.photos/seed/user2/200/200',
  workplace: 'CERN',
  fieldOfStudy: 'Physics',
  bio: 'Exploring the fundamental particles of the universe. Quantum mechanics enthusiast.',
  interests: ['Quantum Physics', 'Astrophysics']
};

export const MOCK_AUTHOR_USER: UserProfile = {
  id: 'u3',
  name: 'Dr. James Doe',
  nickname: 'jim_doe',
  avatarUrl: 'https://picsum.photos/seed/user3/200/200',
  workplace: 'Oxford University',
  fieldOfStudy: 'Biology',
  bio: 'Author of several papers on CRISPR.',
  interests: ['CRISPR', 'Bioinformatics']
};

const SOURCES = ['Nature', 'Science', 'arXiv', 'IEEE Access', 'BioRxiv'];

// Helper to generate deterministic articles
export const generateArticles = (count: number): Article[] => {
  return Array.from({ length: count }).map((_, i) => {
    const seed = i + 1;
    const tagCount = Math.floor(Math.random() * 3) + 1;
    const articleTags = Array.from({ length: tagCount }).map(() => 
      AVAILABLE_TAGS[Math.floor(Math.random() * AVAILABLE_TAGS.length)]
    );

    return {
      id: `art-${seed}`,
      title: [
        'Advances in Deep Reinforcement Learning for Robotics',
        'Quantum Entanglement in Macroscopic Systems',
        'CRISPR-Cas9 Gene Editing: A New Era',
        'The Impact of Climate Change on Marine Biodiversity',
        'Efficient Blockchain Protocols for IoT',
        'Neural Networks for Early Disease Detection',
        'Dark Matter Distribution in Galaxy Clusters',
        'Sustainable Energy Storage Solutions',
        'The Future of Human-Computer Interaction',
        'Topological Insulators and Superconductivity'
      ][i % 10] + ` (Vol. ${seed})`,
      abstract: `This paper explores the fundamental principles of ${articleTags[0]} and its applications. We present a novel approach that improves efficiency by 25% compared to state-of-the-art methods. The results suggest significant potential for future research in ${articleTags[1] || 'related fields'}.`,
      authors: [
        { id: `au-${seed}-1`, name: 'J. Doe' },
        { id: `au-${seed}-2`, name: 'A. Smith' }
      ],
      tags: [...new Set(articleTags)], // Dedup tags
      source: SOURCES[i % SOURCES.length],
      publishedAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
      doi: `10.1038/s41586-024-${1000 + seed}`,
      imageUrl: `https://picsum.photos/seed/${seed}/600/${Math.floor(Math.random() * 400 + 600)}`, // Random height for masonry
      likes: Math.floor(Math.random() * 500)
    };
  });
};

export const MOCK_ARTICLES = generateArticles(50);

export const MOCK_COLLECTIONS: Collection[] = [
  {
    id: 'col-1',
    name: 'Thesis Research',
    articleIds: ['art-1', 'art-3'],
    coverImage: MOCK_ARTICLES[0].imageUrl,
    ownerId: 'u1',
    isPrivate: true,
    visibility: 'private'
  },
  {
    id: 'col-2',
    name: 'Weekend Reading',
    articleIds: ['art-5'],
    coverImage: MOCK_ARTICLES[4].imageUrl,
    ownerId: 'u1',
    isPrivate: false,
    visibility: 'public'
  },
  {
    id: 'col-3',
    name: 'Quantum Mechanics',
    articleIds: ['art-2', 'art-7'],
    coverImage: MOCK_ARTICLES[1].imageUrl,
    ownerId: 'u2',
    isPrivate: false,
    visibility: 'public'
  }
];
