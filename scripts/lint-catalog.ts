import fs from 'fs';
import path from 'path';
import { movieSchema, seriesSchema, categorySchema } from '../lib/schemas';

const dataDir = path.join(__dirname, '..', 'data');
const moviesDir = path.join(dataDir, 'catalog', 'movies');
const seriesDir = path.join(dataDir, 'catalog', 'series');
const categoriesPath = path.join(dataDir, 'categories', 'categories.json');

function readJson(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function validateMovies() {
  const files = fs.readdirSync(moviesDir).filter((file) => file.endsWith('.json'));
  files.forEach((file) => {
    const data = readJson(path.join(moviesDir, file));
    movieSchema.parse(data);
  });
  return files.length;
}

function validateSeries() {
  const files = fs.readdirSync(seriesDir).filter((file) => file.endsWith('.json'));
  files.forEach((file) => {
    const data = readJson(path.join(seriesDir, file));
    seriesSchema.parse(data);
  });
  return files.length;
}

function validateCategories() {
  const categories = readJson(categoriesPath);
  if (!Array.isArray(categories)) {
    throw new Error('Le fichier des catégories doit contenir un tableau.');
  }
  categories.forEach((category) => categorySchema.parse(category));
  return categories.length;
}

function main() {
  const moviesCount = validateMovies();
  const seriesCount = validateSeries();
  const categoriesCount = validateCategories();
  console.log(`Catalogue valide: ${moviesCount} films, ${seriesCount} séries, ${categoriesCount} catégories.`);
}

main();
