@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(inputTexture);
  let uv = vec2<f32>(id.xy) / vec2<f32>(size);
  
  // Sample velocity at current position
  let velocity = textureLoad(inputTexture, id.xy, 0).xy;
  
  // Trace back in time
  let backPos = uv - velocity * DT;
  
  // Sample previous value
  let value = textureSample(inputTexture, backPos);
  
  // Write to output
  textureStore(outputTexture, id.xy, value);
}