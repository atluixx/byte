import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from '.';

export const playerStats = sqliteTable('player_stats', {
    userId: text('user_id')
        .primaryKey()
        .references(() => users.id),
    level: integer('level').default(1),
    xp: integer('xp').default(0),
    hp: integer('hp').default(100),
    mp: integer('mp').default(50),
    coins: integer('gold').default(0),
    class: text('class').default('warrior'),
    strength: integer('strength').default(10),
    defense: integer('defense').default(10),
    agility: integer('agility').default(10),
    magic: integer('magic').default(10),
    battlesWon: integer('battles_won').default(0),
    battlesLost: integer('battles_lost').default(0),
    questsCompleted: integer('quests_completed').default(0),
    itemsCollected: integer('items_collected').default(0),
    lastActive: integer('last_active').default(Math.floor(Date.now() / 1000)),
});
