/**
 * 角色立绘（Q 版）与卡池海报
 * 目前仅有 Claude / GPT / DeepSeek 三张已裁剪资源；其余角色为白色占位。
 */
import claude from './assets/portraits/claude.png';
import gpt from './assets/portraits/gpt.png';
import deepseek from './assets/portraits/deepseek.png';
import kimi from './assets/portraits/kimi.png';
import glm from './assets/portraits/glm.png';
import gemini from './assets/portraits/gemini.png';
import claudeP from './assets/posters/claude.png';
import gptP from './assets/posters/gpt.png';
import deepseekP from './assets/posters/deepseek.png';
import kimiP from './assets/posters/kimi.png';
import glmP from './assets/posters/glm.png';
import geminiP from './assets/posters/gemini.png';
import monster from './assets/monster.png';

/** 怪物头像 */
export const monsterImg = monster;

/** 角色 Q 版立绘（战斗/图鉴/抽卡结果/教程使用） */
export const charImages: Record<string, string> = {
  'Claude娘': claude,
  'GPT娘': gpt,
  'DeepSeek娘': deepseek,
  'Kimi娘': kimi,
  'GLM娘': glm,
  'Gemini娘': gemini,
};

/** 卡池海报（抽卡 UP 展示使用） */
export const charPosters: Record<string, string> = {
  'Claude娘': claudeP,
  'GPT娘': gptP,
  'DeepSeek娘': deepseekP,
  'Kimi娘': kimiP,
  'GLM娘': glmP,
  'Gemini娘': geminiP,
};
