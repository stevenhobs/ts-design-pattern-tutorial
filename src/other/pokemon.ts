import { clear } from 'console'
import { loader, RecordHandler } from './loader'
clear()

type Listener<EventType> = (event: EventType) => void
interface Observer<EventType> {
    subscribe: (listener: Listener<EventType>) => () => void
    publish: (event: EventType) => void
}
function createObserver<EventType>(): Observer<EventType> {
    let listeners: Listener<EventType>[] = []
    return {
        subscribe(listener) {
            listeners.push(listener)
            return () => {
                listeners = listeners.filter(l => l != listener)
            }
        },
        publish(event) {
            listeners.forEach(l => l(event))
        },
    }
}

interface beforeSetEvent<T> {
    value: T
    newValue: T
}
interface afterSetEvent<T> {
    value: T
}

interface Pokemon extends BaseRecord {
    attack: number
    defense: number
}

interface BaseRecord {
    id: string
}

interface Database<T> {
    set(newValue: T): void
    get(id: string): T

    onBeforeAdd(listener: Listener<beforeSetEvent<T>>): () => void
    onAfterAdd(listener: Listener<afterSetEvent<T>>): () => void
    visit(visitor: (item: T) => void): void

    selectBest(scoreStrategy: (item: T) => number): { item: T; max: number }
}

function createDatabaseInstance<T extends BaseRecord>() {
    class InMemoryDatabase implements Database<T> {
        private db: Record<string, T> = {}

        private beforeAddObserver = createObserver<beforeSetEvent<T>>()
        private afterAddObserver = createObserver<afterSetEvent<T>>()

        static instance = new InMemoryDatabase()

        private constructor() {}

        public set(newValue: T): void {
            this.beforeAddObserver.publish({
                newValue: newValue,
                value: this.db[newValue.id],
            })
            this.db[newValue.id] = newValue
            this.afterAddObserver.publish({
                value: newValue,
            })
        }

        public get(id: string): T | undefined {
            return this.db[id]
        }

        onBeforeAdd(listener: Listener<beforeSetEvent<T>>) {
            return this.beforeAddObserver.subscribe(listener)
        }

        onAfterAdd(listener: Listener<afterSetEvent<T>>) {
            return this.afterAddObserver.subscribe(listener)
        }

        visit(visitor: (item: T) => void) {
            Object.values(this.db).forEach(item => visitor(item))
        }

        selectBest(scoreStrategy: (item: T) => number) {
            const found: {
                max: number
                item: T | undefined
            } = {
                max: 0,
                item: undefined,
            }

            Object.values(this.db).reduce((f, item) => {
                const score = scoreStrategy(item)
                if (score > f.max) {
                    f.max = score
                    f.item = item
                }
                return f
            }, found)

            return found
        }
    }

    return InMemoryDatabase.instance
}

/* test */
const pokemonDB = createDatabaseInstance<Pokemon>()

pokemonDB.onAfterAdd(({ value }) => console.log('new Record >> ', value))

class PokemonDBAdapter implements RecordHandler<Pokemon> {
    addRecord(record: Pokemon): void {
        pokemonDB.set(record)
    }
}

loader('data.json', new PokemonDBAdapter())
