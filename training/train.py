import torch
import os

# 1. Хак для совместимости: если торч не знает про int1, подменяем его
if not hasattr(torch, "int1"):
    torch.int1 = torch.int8

from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer
from datasets import load_dataset

# Конфигурация
model_id = "unsloth/Qwen2.5-Coder-1.5B-Instruct-bnb-4bit"
dataset_path = "D:/final_train_data.jsonl"

print("--- Инициализация обучения ---")

# 2. Загрузка токенизатора
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.pad_token = tokenizer.eos_token

# 3. Настройка квантования (4-bit)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
)

# 4. Загрузка модели
print(f"Загрузка модели {model_id}...")
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    device_map="auto",
)

# 5. Конфигурация LoRA (адаптеры для дообучения)
peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

# 6. Функция форматирования данных (обязательно выше трейнера)
def format_prompts(example):
    # Убираем цикл, так как SFTTrainer передает одну строку за раз
    text = f"### Instruction:\n{example['instruction']}\n\n### Input:\n{example['input']}\n\n### Response:\n{example['output']}<|endoftext|>"
    return text

# 7. Загрузка датасета
if not os.path.exists(dataset_path):
    print(f"ОШИБКА: Файл {dataset_path} не найден!")
    exit()

dataset = load_dataset("json", data_files=dataset_path, split="train")

# 8. Настройка трейнера
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    peft_config=peft_config,
    formatting_func=format_prompts,
    args=TrainingArguments(
        per_device_train_batch_size=2,   # Можно попробовать 2 для 1.5B модели
        gradient_accumulation_steps=4,
        warmup_steps=5,
        max_steps=60,                   # Для хакатона 60-100 шагов обычно хватает
        learning_rate=2e-4,
        fp16=False,
        logging_steps=1,
        output_dir="outputs",
        save_strategy="no",
        report_to="none"
    ),
)

# 9. ПОЕХАЛИ!
print("Начинаю обучение...")
trainer.train()

# 10. Сохранение результата
print("Обучение завершено. Сохраняю модель...")
trainer.model.save_pretrained("sql_model_finetuned") 
tokenizer.save_pretrained("sql_model_finetuned")

print("Готово! Модель сохранена в папку sql_model_finetuned")