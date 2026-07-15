const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.controller.ts');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  if (content.includes('@Query(\'page\')')) continue;

  if (content.includes('findAll(@Query(\'cityId\') cityId?: string) {')) {
    content = content.replace(
      'findAll(@Query(\'cityId\') cityId?: string) {',
      'findAll(@Query(\'cityId\') cityId?: string, @Query(\'page\') page?: string, @Query(\'limit\') limit?: string) {'
    );
    content = content.replace(
      'return this.service.findAll({ where: { cityId } });',
      'return this.service.findAll(cityId ? { where: { cityId } } : undefined, page ? Number(page) : undefined, limit ? Number(limit) : undefined);'
    );
  } else if (content.includes('findAll() {') && !file.includes('transits.controller.ts') && !file.includes('users.controller.ts')) {
    content = content.replace(
      'findAll() {',
      'findAll(@Query(\'page\') page?: string, @Query(\'limit\') limit?: string) {'
    );
    content = content.replace(
      'return this.service.findAll();',
      'return this.service.findAll(undefined, page ? Number(page) : undefined, limit ? Number(limit) : undefined);'
    );
  }

  if (content.includes('@Query(\'page\')') && !content.includes('Query,')) {
    content = content.replace('Param,', 'Param,\n  Query,');
  }

  fs.writeFileSync(file, content);
}
console.log('Updated controllers');
