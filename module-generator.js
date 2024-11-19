const fs = require('fs');
const path = require('path');

// For Generate Entity
function generateEntityProps(props) {
  return props
    .map(
      (prop) => `
    @Prop(${!prop.required ? '{ required: true }' : ''})
    ${prop.name}: ${prop.type};
    `,
    )
    .join('\n');
}

function toPascalCase(str) {
  return str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())
    .join('');
}

function extractModuleName(variableName) {
  // Detect and remove known prefixes like `tm_` or `tt_`
  const prefixMatch = variableName.match(/^(tm_|tt_|th_)/);
  if (!prefixMatch) {
    throw new Error(
      'Invalid variable name: Must start with a known prefix (e.g., tm_, tt_)',
    );
  }
  return toPascalCase(variableName.replace(prefixMatch[0], ''));
}

function addModuleToResourceProviders(moduleName, modulePath, resourcePath) {
  const relativeModulePath = `./${modulePath.toLowerCase()}/${moduleName.toLowerCase()}.module`;
  const moduleImport = `import { ${moduleName}Module } from '${relativeModulePath}';`;

  let fileContent = fs.readFileSync(resourcePath, 'utf8');

  // Check if module is already imported
  if (fileContent.includes(moduleImport)) {
    console.log(`${moduleName}Module is already imported in ${resourcePath}`);
    return;
  }

  // Add the import statement
  const importSectionEnd = fileContent.indexOf(
    'export const resourceProviders',
  );
  fileContent =
    fileContent.slice(0, importSectionEnd) +
    `${moduleImport}\n` +
    fileContent.slice(importSectionEnd);

  // Add the module to the array
  const arrayStart = fileContent.indexOf('[');
  const arrayEnd = fileContent.indexOf(']', arrayStart);
  const existingModules = fileContent.slice(arrayStart + 1, arrayEnd).trim();

  const updatedModules = existingModules
    ? `${existingModules}, ${moduleName}Module`
    : `${moduleName}Module`;

  fileContent =
    fileContent.slice(0, arrayStart + 1) +
    ` ${updatedModules} ` +
    fileContent.slice(arrayEnd);

  // Write the updated content back to the file
  fs.writeFileSync(resourcePath, fileContent, 'utf8');
  console.log(`Added ${moduleName} Module to Resource Provider.`);
}

// For Generate Props
function generateInterfaceProps(props) {
  return props
    .map((prop) => `${prop.name}${!prop.required ? '' : '?'} : ${prop.type};`)
    .join('\n  ');
}

const templates = {
  mongoEntity: (moduleName, collectionName, props) => {
    const parsedProps = Object.entries(props).map(([key, type]) => {
      const isOptional = key.endsWith('?');
      const cleanKey = isOptional ? key.slice(0, -1) : key; // Remove '?' if optional
      return { name: cleanKey, type, required: isOptional };
    });

    return `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseMongoEntity } from 'src/core/base/domain/mongo-entity';

@Schema({ collection: '${collectionName}' })
export class ${toPascalCase(
      moduleName,
    )}MongoEntity extends BaseMongoEntity<typeof ${moduleName}MongoEntity> {
    ${generateEntityProps(parsedProps)}
}

export const ${toPascalCase(
      moduleName,
    )}Schema = SchemaFactory.createForClass(${moduleName}MongoEntity);
export const ${toPascalCase(
      moduleName,
    )}Model = [{ name: ${moduleName}MongoEntity.name, schema: ${moduleName}Schema}];
`;
  },
  entity: (moduleName, props) => {
    const parsedProps = Object.entries(props).map(([key, type]) => {
      const isOptional = key.endsWith('?');
      const cleanKey = isOptional ? key.slice(0, -1) : key; // Remove '?' if optional
      return { name: cleanKey, type, required: isOptional };
    });
    return `import { Entity } from 'src/core/base/domain/entity';
export interface ${toPascalCase(moduleName)}Props {

    ${generateInterfaceProps(parsedProps)}
}

export class ${moduleName}Entity extends Entity<${moduleName}Props> {
    constructor(props: ${moduleName}Props) {
        super(props);
    }
}
  `;
  },
  mapper: (moduleName) => `import { ${toPascalCase(
    moduleName,
  )}Entity } from './${moduleName.toLowerCase()}.entity';
import { ${toPascalCase(
    moduleName,
  )}MongoEntity } from '../repository/${moduleName.toLowerCase()}.mongo-entity';
import {
    DbMapper,
    MongoEntityProps
} from 'src/core/base/domain/db-mapper';
import { staticImplements } from 'src/core/decorator/static-implements.decorator';

@staticImplements<DbMapper<${moduleName}Entity, ${moduleName}MongoEntity>>()
export class ${toPascalCase(moduleName)}Mapper{
    public static toPlainObject(
        entity: ${toPascalCase(moduleName)}Entity
    ): MongoEntityProps<${moduleName}MongoEntity> {
        const entityProps = entity.propsCopy;

        return {
            ...entityProps,
            // Add Domain Field Here Brother
        }
    }

    // If You Want To Customize The Type Provide Here
    public static toDomain(
        raw: ${toPascalCase(moduleName)}MongoEntity
    ): ${toPascalCase(moduleName)}Entity {
        return new ${toPascalCase(moduleName)}Entity(
            raw
        );
    }
}
  `,
  portRepository: (
    moduleName,
  ) => `import { BaseRepositoryPort } from 'src/core/port/repository.base.port';
import { ${toPascalCase(
    moduleName,
  )}Entity } from '../domain/${moduleName.toLowerCase()}.entity';
import { ${toPascalCase(
    moduleName,
  )}MongoEntity } from '../repository/${moduleName.toLowerCase()}.mongo-entity';
export interface ${toPascalCase(moduleName)}RepositoryPort
    extends BaseRepositoryPort<${toPascalCase(
      moduleName,
    )}Entity, ${toPascalCase(moduleName)}MongoEntity> {
    __init__(): void;
}
  `,
  repository: (moduleName) => `import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from'mongoose';
import { BaseRepository } from 'src/core/base/module/repository.base';
import { ${toPascalCase(
    moduleName,
  )}Entity } from '../domain/${moduleName.toLowerCase()}.entity';
import { ${toPascalCase(
    moduleName,
  )}Mapper } from '../domain/${moduleName.toLowerCase()}.mapper';
import { ${toPascalCase(
    moduleName,
  )}MongoEntity } from './${moduleName.toLowerCase()}.mongo-entity';
import { ${toPascalCase(
    moduleName,
  )}RepositoryPort } from '../interface/${moduleName.toLowerCase()}.repository.port';

@Injectable()
export class ${toPascalCase(moduleName)}Repository
extends BaseRepository<${toPascalCase(moduleName)}Entity, ${toPascalCase(
    moduleName,
  )}MongoEntity>
    implements ${toPascalCase(moduleName)}RepositoryPort {
    constructor(
        @InjectModel(${toPascalCase(moduleName)}MongoEntity.name)
        private readonly ${toPascalCase(moduleName)}Model: Model<${toPascalCase(
          moduleName,
        )}MongoEntity>,
    ) {
        super(${toPascalCase(moduleName)}Model, ${toPascalCase(
          moduleName,
        )}Mapper)
    }

    __init__(): void{
        // This Just a Boilerplate, you can delete it
    }
}
  `,
  providerRepository: (
    moduleName,
  ) => `import { Inject, Provider } from '@nestjs/common';
import { ${toPascalCase(
    moduleName,
  )}Repository } from './${moduleName.toLowerCase()}.repository.service';

export const Inject${toPascalCase(
    moduleName,
  )}Repository = Inject(${toPascalCase(moduleName)}Repository.name);

export const ${toPascalCase(moduleName)}RepositoryProvider: Provider = {
    provide: ${toPascalCase(moduleName)}Repository.name,
    useClass: ${toPascalCase(moduleName)}Repository
}
  `,
  moduleRepository: (moduleName) => `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${toPascalCase(
    moduleName,
  )}Model } from './${moduleName.toLowerCase()}.mongo-entity';
import { ${toPascalCase(
    moduleName,
  )}RepositoryProvider } from './${moduleName.toLowerCase()}.repository-provider';

@Module({
    imports: [MongooseModule.forFeature(${toPascalCase(moduleName)}Model)],
    providers: [${toPascalCase(moduleName)}RepositoryProvider,],
    exports: [${toPascalCase(moduleName)}RepositoryProvider,],
})
export class ${toPascalCase(moduleName)}RepositoryModule {}
  `,
  providerUseCase: (moduleName) => `import { Provider } from '@nestjs/common';

export const ${toPascalCase(moduleName)}UseCaseProvider: Provider[] = [];
  `,
  moduleUseCase: (moduleName) => `import { Module } from '@nestjs/common';
import { ${toPascalCase(
    moduleName,
  )}RepositoryModule } from '../repository/${moduleName.toLowerCase()}.repository.module';
import { ${toPascalCase(
    moduleName,
  )}UseCaseProvider } from './${moduleName.toLowerCase()}.use-case-provider';

@Module({
    imports: [${toPascalCase(moduleName)}RepositoryModule],
    providers: ${toPascalCase(moduleName)}UseCaseProvider,
    exports: ${toPascalCase(moduleName)}UseCaseProvider,
})
export class ${toPascalCase(moduleName)}UseCaseModule {}
  `,
  controller: (moduleName) => `import { Controller } from '@nestjs/common';

@Controller('v1/${moduleName.toLowerCase()}')
export class ${toPascalCase(moduleName)}Controller {
    constructor() {}
}
  `,
  module: (moduleName) => `import { Module } from '@nestjs/common';
import { ${toPascalCase(
    moduleName,
  )}RepositoryModule } from './repository/${moduleName.toLowerCase()}.repository.module';
import { ${toPascalCase(
    moduleName,
  )}UseCaseModule } from './use-case/${moduleName.toLowerCase()}.use-case.module';
import { ${toPascalCase(
    moduleName,
  )}Controller } from './controller/${moduleName.toLowerCase()}.controller';

@Module({
    imports: [${toPascalCase(moduleName)}RepositoryModule, ${toPascalCase(
      moduleName,
    )}UseCaseModule],
    controllers: [${toPascalCase(moduleName)}Controller],
})
export class ${toPascalCase(moduleName)}Module {}
  `,
};

function generateModule(folderName, moduleName, collectionName, props) {
  const basePath = path.join(
    __dirname,
    'src',
    'module',
    folderName.toLowerCase(),
    moduleName.toLowerCase(),
  );
  const folders = [
    'domain',
    'repository',
    'use-case',
    'controller',
    'interface',
  ];

  // Creating Folders
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
    folders.forEach((folder) => fs.mkdirSync(path.join(basePath, folder)));
  } else {
    console.log(
      `Folder "${moduleName}" already exists! Going To Createing Files`,
    );
  }

  // Creating MongoEntity
  fs.writeFileSync(
    path.join(
      basePath,
      'repository',
      `${moduleName.toLowerCase()}.mongo-entity.ts`,
    ),
    templates.mongoEntity(moduleName, collectionName, props),
  );

  // Creating Entity
  fs.writeFileSync(
    path.join(basePath, 'domain', `${moduleName.toLowerCase()}.entity.ts`),
    templates.entity(moduleName, props),
  );

  // Creating Mapper
  fs.writeFileSync(
    path.join(basePath, 'domain', `${moduleName.toLowerCase()}.mapper.ts`),
    templates.mapper(moduleName),
  );

  // Creating RepositoryPort
  fs.writeFileSync(
    path.join(
      basePath,
      'interface',
      `${moduleName.toLowerCase()}.repository.port.ts`,
    ),
    templates.portRepository(moduleName),
  );

  // Creating RepositoryService
  fs.writeFileSync(
    path.join(
      basePath,
      'repository',
      `${moduleName.toLowerCase()}.repository.service.ts`,
    ),
    templates.repository(moduleName),
  );

  // Creating RepositoryProvider
  fs.writeFileSync(
    path.join(
      basePath,
      'repository',
      `${moduleName.toLowerCase()}.repository-provider.ts`,
    ),
    templates.providerRepository(moduleName),
  );

  // Creating RepositoryModule
  fs.writeFileSync(
    path.join(
      basePath,
      'repository',
      `${moduleName.toLowerCase()}.repository.module.ts`,
    ),
    templates.moduleRepository(moduleName),
  );

  // Creating UseCaseProvider
  fs.writeFileSync(
    path.join(
      basePath,
      'use-case',
      `${moduleName.toLowerCase()}.use-case-provider.ts`,
    ),
    templates.providerUseCase(moduleName),
  );

  // Creating UseCaseModule
  fs.writeFileSync(
    path.join(
      basePath,
      'use-case',
      `${moduleName.toLowerCase()}.use-case.module.ts`,
    ),
    templates.moduleUseCase(moduleName),
  );

  // Creating Controller
  fs.mkdirSync(path.join(basePath, 'controller', 'dto'));
  fs.writeFileSync(
    path.join(
      basePath,
      'controller',
      `${moduleName.toLowerCase()}.controller.ts`,
    ),
    templates.controller(moduleName),
  );

  // Creating Module
  fs.writeFileSync(
    path.join(basePath, `${moduleName.toLowerCase()}.module.ts`),
    templates.module(moduleName),
  );

  console.log(
    `Module "${moduleName}" Created Successfully With Collection Name: "${collectionName}"!`,
  );

  addModuleToResourceProviders(
    moduleName,
    `${folderName}/${moduleName.toLowerCase()}`,
    'src/module/resource.provider.ts',
  );
}

async function runGenerator() {
  const imported = require('./model');
  imported.models.forEach((module) => {
    const folderName = Object.keys(module)[0];
    module[folderName].forEach((interface) => {
      const collectionName = Object.keys(interface)[0];
      const model = interface[collectionName];
      const moduleName = extractModuleName(collectionName);

      generateModule(folderName, moduleName, collectionName, model);
    });
  });
}

runGenerator();
