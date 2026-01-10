#include <jni.h>
#include "RazorpayNitroOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::razorpaynitro::initialize(vm);
}
