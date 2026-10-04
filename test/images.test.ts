// Checks the search, sort, filter and Previous/Next logic. Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterImages, neighbors, searchImages, sortImages, type NasaImage } from '../src/images.ts'

const image = (id: string, title: string, date: string, center: string, topic: string, keywords: string[] = []) =>
  ({ id, title, date, center, topic, keywords, description: '', thumbUrl: '', imageUrl: '' }) satisfies NasaImage

const all = [
  image('a', 'Apollo 11 Launch', '1969-07-16T00:00:00Z', 'KSC', 'Apollo', ['Saturn V']),
  image('b', 'Rover Selfie', '2019-10-11T00:00:00Z', 'JPL', 'Mars'),
  image('c', 'Hubble Deep Field', '1996-01-15T00:00:00Z', 'GSFC', 'Hubble'),
]
const ids = (list: NasaImage[]) => list.map((i) => i.id)

test('search matches every word in the title or keywords, ignoring case', () => {
  assert.deepEqual(ids(searchImages(all, 'ROVER')), ['b'])
  assert.deepEqual(ids(searchImages(all, 'saturn')), ['a'])
  assert.deepEqual(ids(searchImages(all, 'launch  saturn')), ['a']) // words in any order, title + keyword
  assert.deepEqual(ids(searchImages(all, 'apollo rover')), [])
  assert.deepEqual(ids(searchImages(all, '  ')), ['a', 'b', 'c'])
})

test('sort by title, date and center, ascending and descending', () => {
  assert.deepEqual(ids(sortImages(all, 'title', 'asc')), ['a', 'c', 'b'])
  assert.deepEqual(ids(sortImages(all, 'title', 'desc')), ['b', 'c', 'a'])
  assert.deepEqual(ids(sortImages(all, 'date', 'asc')), ['a', 'c', 'b'])
  assert.deepEqual(ids(sortImages(all, 'center', 'desc')), ['a', 'b', 'c'])
})

test('filters: nothing picked shows all, OR within a group, AND across groups', () => {
  assert.equal(filterImages(all, [], []).length, 3)
  assert.deepEqual(ids(filterImages(all, ['Apollo', 'Mars'], [])), ['a', 'b'])
  assert.deepEqual(ids(filterImages(all, ['Apollo', 'Mars'], ['JPL'])), ['b'])
})

test('Previous and Next wrap around both ends', () => {
  assert.deepEqual(neighbors(['a', 'b', 'c'], 'a'), { prev: 'c', next: 'b', position: 1, total: 3 })
  assert.deepEqual(neighbors(['a', 'b', 'c'], 'c'), { prev: 'b', next: 'a', position: 3, total: 3 })
  assert.equal(neighbors(['a'], 'a'), undefined)
  assert.equal(neighbors(['a', 'b'], 'z'), undefined)
})
