@group(0) @binding(0) var velocityTexture: texture_2d<f32>;
@group(0) @binding(1) var divergenceTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(velocityTexture);
  let x = id.x;
  let y = id.y;
  
  // Get neighboring velocities
  let right = textureLoad(velocityTexture, vec2<u32>(x+1, y), 0).xy;
  let left = textureLoad(velocityTexture, vec2<u32>(x-1, y), 0).xy;
  let top = textureLoad(velocityTexture, vec2<u32>(x, y+1), 0).xy;
  let bottom = textureLoad(velocityTexture, vec2<u32>(x, y-1), 0).xy;
  
  // Calculate divergence
  let divergence = 0.5 * ((right.x - left.x) + (top.y - bottom.y));
  
  // Store result
  textureStore(divergenceTexture, id.xy, vec4<f32>(divergence, 0.0, 0.0, 1.0));
}