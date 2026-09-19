import wheatData from '../data/crops/wheat.json';
import rainClassesData from '../data/rain-classes.json';
import soilsData from '../data/soils.json';
import impactMatrixData from '../data/impact-matrix.json';
import adviceTemplatesData from '../data/advice-templates.json';
import { CropDefinition, SoilType, RainClass } from './types';

export class AgronomyDataLoader {
  private static cropRegistry: Record<string, CropDefinition> = {
    wheat: wheatData as unknown as CropDefinition,
  };

  public static getCrop(cropId: string = 'wheat'): CropDefinition {
    const crop = this.cropRegistry[cropId.toLowerCase()];
    if (!crop) {
      throw new Error(`Crop definition not found for: ${cropId}. To add a new crop, add a json definition to /data/crops/ without changing engine code.`);
    }
    return crop;
  }

  public static getAllSoils(): SoilType[] {
    return soilsData.soils as SoilType[];
  }

  public static getSoil(soilId: string = 'loam'): SoilType {
    const soil = (soilsData.soils as SoilType[]).find((s) => s.id === soilId);
    if (!soil) {
      // Fallback to loam as standard baseline
      return (soilsData.soils as SoilType[])[2];
    }
    return soil;
  }

  public static getRainClasses(): RainClass[] {
    return rainClassesData.classes as RainClass[];
  }

  public static getImpactMatrix(): typeof impactMatrixData {
    return impactMatrixData;
  }

  public static getAdviceTemplates(): typeof adviceTemplatesData {
    return adviceTemplatesData;
  }

  public static isAgronomyVerified(cropId: string, soilId?: string): boolean {
    const crop = this.getCrop(cropId);
    if (!crop.verified) return false;
    if (crop.stages.some((s) => !s.verified)) return false;
    if (soilId) {
      const soil = this.getSoil(soilId);
      if (!soil.verified) return false;
    }
    if (!impactMatrixData.verified) return false;
    return true;
  }
}
