/* eslint-disable @next/next/no-img-element */

import type { Metadata } from 'next';
import { ProductCardLabContent } from './ProductCardLabContent';

export const metadata: Metadata = {
    title: 'Product Card Lab — 1px Border 兼容性',
};

export default function ProductCardLabPage() {
    return <ProductCardLabContent />;
}
