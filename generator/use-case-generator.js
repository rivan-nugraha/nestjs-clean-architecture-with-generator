const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

/**
 * Fungsi untuk mencari file dengan pola tertentu dalam direktori secara rekursif.
 * @param {string} dir - Direktori awal.
 * @param {RegExp} pattern - Pola pencarian file.
 * @returns {string[]} - Array path lengkap file yang cocok dengan pola.
 */
function findModules(dir, pattern) {
  const result = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      result.push(...findModules(filePath, pattern));
    } else if (stat.isFile() && pattern.test(file)) {
      result.push(filePath);
    }
  }

  return result;
}

function toPascalCase(str) {
  return str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())
    .join('');
}

const templates = {
  createDto: (moduleName) => `import * as z from 'zod';
export const Create${toPascalCase(moduleName)}RequestDto = z.object({});
export type Create${toPascalCase(
    moduleName,
  )}RequestDto = z.infer<typeof Create${toPascalCase(moduleName)}RequestDto>;
  `,
  createUseCase: (
    moduleName,
  ) => `import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BaseUseCase } from 'src/core/base/module/use-case.base';
import { PickUseCasePayload } from 'src/core/base/types/pick-use-case-payload.type';
import { Create${toPascalCase(
    moduleName,
  )}RequestDto } from '../controller/dto/create-${moduleName}-request.dto.ts';
import { Inject${toPascalCase(
    moduleName,
  )}Repository } from '../repository/${moduleName}.repository-provider';
import { ${toPascalCase(
    moduleName,
  )}RepositoryPort } from '../interface/${moduleName}.repository.port';
import { ${toPascalCase(
    moduleName,
  )}Entity } from '../domain/${moduleName}.entity';
import { ResponseDto } from 'src/core/base/http/response.dto.base';
import { IRepositoryResponse } from 'src/core/interface/repository-response.interface';

type Create${toPascalCase(
    moduleName,
  )}RequestPayload = PickUseCasePayload<Create${moduleName}RequestDto, 'data'>

@Injectable()
export class Create${toPascalCase(
    moduleName,
  )}UseCase BaseUseCase<Create${moduleName}RequestPayload, ResponseDto>{
  constructor(
    @Inject${toPascalCase(
      moduleName,
    )}Repository private readonly ${moduleName}Repository: ${toPascalCase(
      moduleName,
    )}RepositoryPort){
        super();
    }

    public async execute({ data }: Create${toPascalCase(
      moduleName,
    )}RequestPayload) Promise<ResponseDto<IRepositoryResponse>> {
        try {
            const ${moduleName}Entity = new ${toPascalCase(
              moduleName,
            )}Entity({});
            const ${moduleName} = await this.${toPascalCase(
              moduleName,
            )}repository.save(${moduleName}Entity);
            return new ResponseDto({
                status: HttpStatus.CREATED,
                data: ${moduleName},
                message: "Data Tersimpan"
            })
        } catch(err) {
            this.logger.error(error);
            if (err instanceof HttpExeption) throw err;
            throw new HttpExeption(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
`,
};

function generateUseCase(moduleName) {
  for (const module of moduleName) {
    const splited = module.split('/');
    const getModulePattern = splited[splited.length - 1];
    const splitModulePattern = getModulePattern.split('.');
    const modulePattern = splitModulePattern[0];

    splited.pop();

    fs.writeFileSync(
      path.join(
        '/',
        ...splited,
        'controller',
        'dto',
        `create-${modulePattern.toLowerCase()}-request.dto.ts`,
      ),
      templates.createDto(modulePattern),
    );

    fs.writeFileSync(
      path.join(
        '/',
        ...splited,
        'use-case',
        `create-${modulePattern.toLowerCase()}.use-case.ts`,
      ),
      templates.createUseCase(modulePattern),
    );
  }
}

const baseDir = path.join(__dirname, '../', 'src', 'module');
const modulePattern = /^[a-zA-Z0-9_]+\.module\.ts$/;

const allModules = findModules(baseDir, modulePattern);

inquirer
  .prompt([
    {
      type: 'checkbox',
      name: 'selectedModules',
      message: 'Select The Module Where You Want To Generate The Use-Case?',
      choices: allModules.map((modulePath) => ({
        name: path.relative(baseDir, modulePath),
        value: modulePath,
      })),
    },
  ])
  .then((answers) => {
    const { selectedModules } = answers;

    if (selectedModules.length > 0) {
      console.log(`Selected Path:`, selectedModules);
      generateUseCase(selectedModules);
    } else {
      console.log('There Is No Path Selected.');
    }
  })
  .catch((error) => {
    console.error('Terjadi kesalahan:', error);
  });
