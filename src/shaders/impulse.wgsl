@group(0) @binding(0) var temperatureTexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(1) var densityTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(temperatureTexture);
  let uv = vec2<f32>(id.xy) / vec2<f32>(size);
  
  // Only add heat/fuel at the bottom center (candle wick)
  if (uv.x > 0.45 && uv.x < 0.55 && uv.y < 0.1) {
    // Add temperature (fire)
    textureStore(temperatureTexture, id.xy, vec4<f32>(1.0, 0.0, 0.0, 1.0));
    
    // Add density (soot/fuel)
    textureStore(densityTexture, id.xy, vec4<f32>(0.8, 0.0, 0.0, 1.0));
  }
}