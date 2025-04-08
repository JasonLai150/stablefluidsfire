@group(0) @binding(0) var velocityTexture: texture_2d<f32>;
@group(0) @binding(1) var temperatureTexture: texture_2d<f32>;
@group(0) @binding(2) var densityTexture: texture_2d<f32>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(velocityTexture);
  let uv = vec2<f32>(id.xy) / vec2<f32>(size);
  
  // Get current velocity
  let velocity = textureLoad(velocityTexture, id.xy, 0).xy;
  
  // Get temperature and density
  let temperature = textureLoad(temperatureTexture, id.xy, 0).x;
  let density = textureLoad(densityTexture, id.xy, 0).x;
  
  // Calculate buoyancy force
  let buoyancy = vec2<f32>(0.0, 0.1 * temperature - 0.05 * density);
  
  // Update velocity
  let newVelocity = velocity + buoyancy * DT;
  
  // Write to output
  textureStore(outputTexture, id.xy, vec4<f32>(newVelocity, 0.0, 1.0));
}