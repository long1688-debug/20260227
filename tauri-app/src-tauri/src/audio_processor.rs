// 音频处理模块
// 实现噪声抑制、回声消除等音频处理功能

use std::collections::VecDeque;

// 音频处理器配置
#[derive(Debug, Clone)]
pub struct AudioProcessorConfig {
    pub noise_gate_threshold: f32,  // 噪声门阈值
    pub noise_suppression_level: f32, // 噪声抑制级别 (0.0 - 1.0)
    pub echo_cancellation: bool,      // 是否启用回声消除
    pub normalize: bool,              // 是否启用音频归一化
}

impl Default for AudioProcessorConfig {
    fn default() -> Self {
        AudioProcessorConfig {
            noise_gate_threshold: 0.02,  // -40dB
            noise_suppression_level: 0.5,
            echo_cancellation: true,
            normalize: true,
        }
    }
}

// 音频处理器
pub struct AudioProcessor {
    config: AudioProcessorConfig,
    noise_floor: f32,
    level_history: VecDeque<f32>,
    max_history_size: usize,
}

impl AudioProcessor {
    pub fn new(config: AudioProcessorConfig) -> Self {
        AudioProcessor {
            config,
            noise_floor: 0.0,
            level_history: VecDeque::with_capacity(100),
            max_history_size: 100,
        }
    }

    pub fn with_default_config() -> Self {
        Self::new(AudioProcessorConfig::default())
    }

    /// 处理音频数据
    pub fn process(&mut self, audio_data: &mut [f32]) {
        // 1. 计算音频电平
        let level = self.calculate_level(audio_data);

        // 2. 更新噪声底
        self.update_noise_floor(level);

        // 3. 应用噪声门
        if self.config.noise_gate_threshold > 0.0 {
            self.apply_noise_gate(audio_data, level);
        }

        // 4. 应用噪声抑制
        if self.config.noise_suppression_level > 0.0 {
            self.apply_noise_suppression(audio_data);
        }

        // 5. 应用归一化
        if self.config.normalize {
            self.apply_normalization(audio_data);
        }

        // 6. 更新电平历史
        self.update_level_history(level);
    }

    /// 计算音频电平
    fn calculate_level(&self, audio_data: &[f32]) -> f32 {
        if audio_data.is_empty() {
            return 0.0;
        }

        let sum: f32 = audio_data.iter()
            .map(|&x| x.abs())
            .sum();

        sum / audio_data.len() as f32
    }

    /// 更新噪声底
    fn update_noise_floor(&mut self, level: f32) {
        // 使用滑动窗口计算噪声底
        self.level_history.push_back(level);
        if self.level_history.len() > self.max_history_size {
            self.level_history.pop_front();
        }

        // 噪声底为历史电平的最小值
        if self.level_history.len() >= 10 {
            self.noise_floor = *self.level_history.iter()
                .min_by(|a, b| a.partial_cmp(b).unwrap())
                .unwrap();
        }
    }

    /// 应用噪声门
    fn apply_noise_gate(&self, audio_data: &mut [f32], level: f32) {
        let threshold = self.config.noise_gate_threshold.max(self.noise_floor * 1.5);

        if level < threshold {
            // 低于阈值，应用衰减
            let gain = level / threshold;
            for sample in audio_data.iter_mut() {
                *sample *= gain;
            }
        }
    }

    /// 应用噪声抑制
    fn apply_noise_suppression(&mut self, audio_data: &mut [f32]) {
        // 简单的频谱减法噪声抑制
        // 实际应用中可以使用更复杂的算法，如 RNNoise

        let noise_level = self.noise_floor * self.config.noise_suppression_level;

        for sample in audio_data.iter_mut() {
            let abs_sample = sample.abs();

            // 如果信号接近噪声底，进行抑制
            if abs_sample < noise_level * 2.0 {
                let suppression = abs_sample / (noise_level * 2.0);
                *sample *= suppression;
            }
        }
    }

    /// 应用归一化
    fn apply_normalization(&self, audio_data: &mut [f32]) {
        // 找到最大值
        let max_value = audio_data.iter()
            .map(|&x| x.abs())
            .fold(0.0f32, |a, b| a.max(b));

        if max_value > 0.0 {
            // 归一化到 -3dB
            let target_level = 0.707; // -3dB
            let gain = target_level / max_value;

            // 限制增益范围
            let gain = gain.min(2.0).max(0.5);

            for sample in audio_data.iter_mut() {
                *sample *= gain;
            }
        }
    }

    /// 更新电平历史
    fn update_level_history(&mut self, level: f32) {
        self.level_history.push_back(level);
        if self.level_history.len() > self.max_history_size {
            self.level_history.pop_front();
        }
    }

    /// 获取当前噪声底
    pub fn get_noise_floor(&self) -> f32 {
        self.noise_floor
    }

    /// 获取当前音频电平
    pub fn get_current_level(&self) -> f32 {
        self.level_history.back().copied().unwrap_or(0.0)
    }

    /// 更新配置
    pub fn update_config(&mut self, config: AudioProcessorConfig) {
        self.config = config;
    }
}

impl Default for AudioProcessor {
    fn default() -> Self {
        Self::with_default_config()
    }
}
