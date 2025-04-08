@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(1) var<uniform> clearColor: vec4<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  textureStore(outputTexture, id.xy, clearColor);
}