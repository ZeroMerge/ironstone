export interface Collection { id: string; name: string; images: string[]; }
export interface Category { id: string; name: string; collections: Collection[]; }

export const CATALOGUE: Category[] = [
  {
    id: 'graphic-design',
    name: 'Graphic Design',
    collections: [
      { id: 'brutalism', name: 'Brutalism', images: ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=1600&auto=format&fit=crop'] },
      { id: 'swiss', name: 'Swiss', images: ['https://images.unsplash.com/photo-1572044162444-ad60f128bdea?q=80&w=1600&auto=format&fit=crop'] },
      { id: 'minimalism', name: 'Minimalism', images: ['https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?q=80&w=1600&auto=format&fit=crop'] },
      { id: 'y2k', name: 'Y2K', images: ['https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=1600&auto=format&fit=crop'] }
    ]
  },
  {
    id: 'photography',
    name: 'Photography',
    collections: [
      { id: 'editorial', name: 'Editorial', images: ['https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?q=80&w=1600&auto=format&fit=crop'] },
      { id: 'product', name: 'Product', images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1600&auto=format&fit=crop'] }
    ]
  },
  { id: 'branding', name: 'Branding', collections: [] },
  { id: 'campaigns', name: 'Campaigns', collections: [] },
  { id: 'events', name: 'Events', collections: [] },
];

