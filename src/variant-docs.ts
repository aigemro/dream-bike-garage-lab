import doc0 from '../docs/variants/merge-free-board.md?raw';
import doc1 from '../docs/variants/merge-order.md?raw';
import doc2 from '../docs/variants/merge-guided.md?raw';
import doc3 from '../docs/variants/collection-catalog.md?raw';
import doc4 from '../docs/variants/collection-garage.md?raw';
import doc5 from '../docs/variants/collection-dream-bike.md?raw';
import doc6 from '../docs/variants/assembly-auto.md?raw';
import doc7 from '../docs/variants/assembly-slots.md?raw';
import doc8 from '../docs/variants/input-tap.md?raw';
import doc9 from '../docs/variants/input-drag.md?raw';
import doc14 from '../docs/variants/input-hybrid.md?raw';
import doc15 from '../docs/variants/responsive-fit.md?raw';
import doc16 from '../docs/variants/responsive-reflow.md?raw';
import doc17 from '../docs/variants/responsive-safe-area.md?raw';
import doc10 from '../docs/variants/storage-local.md?raw';
import doc11 from '../docs/variants/storage-indexed-db.md?raw';
import doc12 from '../docs/variants/toss-lifecycle.md?raw';
import doc13 from '../docs/variants/toss-sdk.md?raw';
import doc18 from '../docs/variants/merge-board-size.md?raw';
import doc19 from '../docs/variants/supply-instant.md?raw';
import doc20 from '../docs/variants/supply-parcel.md?raw';
import doc21 from '../docs/variants/supply-generator.md?raw';
import doc22 from '../docs/variants/reward-fixed-salary.md?raw';
import doc23 from '../docs/variants/reward-performance-bonus.md?raw';
import doc24 from '../docs/variants/reward-soft-timer.md?raw';
import doc25 from '../docs/variants/home-play-focus.md?raw';
import doc26 from '../docs/variants/home-order-focus.md?raw';
import doc27 from '../docs/variants/home-hub-focus.md?raw';
import doc28 from '../docs/variants/home-garage-lobby.md?raw';
import doc29 from '../docs/variants/home-garage-agreement.md?raw';
import doc30 from '../docs/variants/level-linear.md?raw';
import doc31 from '../docs/variants/level-chapter.md?raw';
import doc32 from '../docs/variants/level-career.md?raw';
import doc33 from '../docs/variants/career-auto.md?raw';
import doc34 from '../docs/variants/career-mission.md?raw';
import doc35 from '../docs/variants/career-collection.md?raw';
import doc36 from '../docs/variants/economy-fixed.md?raw';
import doc37 from '../docs/variants/economy-performance.md?raw';
import doc38 from '../docs/variants/economy-choice.md?raw';
import doc39 from '../docs/variants/feedback-casual.md?raw';
import doc40 from '../docs/variants/feedback-mechanical.md?raw';
import doc41 from '../docs/variants/feedback-reward.md?raw';
import doc42 from '../docs/variants/background-16bit.md?raw';
import doc43 from '../docs/variants/background-32bit.md?raw';
import doc44 from '../docs/variants/background-ui-friendly.md?raw';
import doc45 from '../docs/variants/home-design-warm-pixel.md?raw';
import doc46 from '../docs/variants/home-design-dusk-workshop.md?raw';
import doc47 from '../docs/variants/home-design-retro-pixel.md?raw';
import doc48 from '../docs/variants/home-design-modern-casual.md?raw';
import doc49 from '../docs/variants/character-warm-pixel.md?raw';
import doc50 from '../docs/variants/ui-warm-pixel.md?raw';
import doc51 from '../docs/variants/motion-warm-pixel.md?raw';
import doc52 from '../docs/variants/music-warm-pixel.md?raw';
import doc53 from '../docs/variants/sfx-warm-pixel.md?raw';
import doc54 from '../docs/variants/order-cycle.md?raw';
import doc55 from '../docs/variants/board-free-cleanup.md?raw';
import doc56 from '../docs/variants/assembly-presentation-auto.md?raw';
import doc57 from '../docs/variants/assembly-presentation-confirm.md?raw';
import doc58 from '../docs/variants/mvp-integration-core-features.md?raw';
import doc59 from '../docs/variants/collection-design-catalog.md?raw';
import doc60 from '../docs/variants/collection-design-showcase.md?raw';
import doc61 from '../docs/variants/collection-design-dream.md?raw';
import doc62 from '../docs/variants/game-screen-design-warm-pixel.md?raw';
import doc63 from '../docs/variants/profile-design-id-card.md?raw';
import doc64 from '../docs/variants/profile-design-career-board.md?raw';
import doc65 from '../docs/variants/profile-design-stats-dashboard.md?raw';
import doc66 from '../docs/variants/storage-integrated-auto.md?raw';
import doc67 from '../docs/variants/game-screen-design-warm-mobile.md?raw';
import doc68 from '../docs/variants/reward-settlement-envelope.md?raw';
import doc69 from '../docs/variants/guide-overlay-bubble.md?raw';
import doc70 from '../docs/variants/settings-drawer.md?raw';
import doc71 from '../docs/variants/title-loading-signboard.md?raw';

const variantDocs: Record<string, string> = {
  'merge-free-board': doc0,
  'merge-order': doc1,
  'merge-guided': doc2,
  'collection-catalog': doc3,
  'collection-garage': doc4,
  'collection-dream-bike': doc5,
  'assembly-auto': doc6,
  'assembly-slots': doc7,
  'input-tap': doc8,
  'input-drag': doc9,
  'input-hybrid': doc14,
  'responsive-fit': doc15,
  'responsive-reflow': doc16,
  'responsive-safe-area': doc17,
  'storage-local': doc10,
  'storage-indexed-db': doc11,
  'toss-lifecycle': doc12,
  'toss-sdk': doc13,
  'merge-board-size': doc18,
  'supply-instant': doc19,
  'supply-parcel': doc20,
  'supply-generator': doc21,
  'reward-fixed-salary': doc22,
  'reward-performance-bonus': doc23,
  'reward-soft-timer': doc24,
  'home-play-focus': doc25,
  'home-order-focus': doc26,
  'home-hub-focus': doc27,
  'home-garage-lobby': doc28,
  'home-garage-agreement': doc29,
  'level-linear': doc30,
  'level-chapter': doc31,
  'level-career': doc32,
  'career-auto': doc33,
  'career-mission': doc34,
  'career-collection': doc35,
  'economy-fixed': doc36,
  'economy-performance': doc37,
  'economy-choice': doc38,
  'feedback-casual': doc39,
  'feedback-mechanical': doc40,
  'feedback-reward': doc41,
  'background-16bit': doc42,
  'background-32bit': doc43,
  'background-ui-friendly': doc44,
  'home-design-warm-pixel': doc45,
  'home-design-dusk-workshop': doc46,
  'home-design-retro-pixel': doc47,
  'home-design-modern-casual': doc48,
  'character-warm-pixel': doc49,
  'ui-warm-pixel': doc50,
  'motion-warm-pixel': doc51,
  'music-warm-pixel': doc52,
  'sfx-warm-pixel': doc53,
  'order-cycle': doc54,
  'board-free-cleanup': doc55,
  'assembly-presentation-auto': doc56,
  'assembly-presentation-confirm': doc57,
  'mvp-integration-core-features': doc58,
  'collection-design-catalog': doc59,
  'collection-design-showcase': doc60,
  'collection-design-dream': doc61,
  'game-screen-design-warm-pixel': doc62,
  'profile-design-id-card': doc63,
  'profile-design-career-board': doc64,
  'profile-design-stats-dashboard': doc65,
  'storage-integrated-auto': doc66,
  'game-screen-design-warm-mobile': doc67,
  'reward-settlement-envelope': doc68,
  'guide-overlay-bubble': doc69,
  'settings-drawer': doc70,
  'title-loading-signboard': doc71,
};

export default variantDocs;
