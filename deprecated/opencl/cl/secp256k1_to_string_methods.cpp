#include "../logging.h"
#include <sstream>
#include <iomanip>
#include "secp256k1_cpp.h"
#include <assert.h>
extern Logger logGPU;

std::string toStringSecp256k1_FieldElement(const secp256k1_fe& input) {
  std::stringstream out;
  for (int i = 9; i >= 0; i --)
    out << std::hex << std::setfill('0') << std::setw(8) << input.n[i];
  return out.str();
}

std::string toStringSecp256k1_FieldElementStorage(const secp256k1_fe_storage& input) {
  std::stringstream out;
  for (int i = 7; i >= 0; i --)
    out << std::hex << std::setfill('0') << std::setw(8) << input.n[i];
  return out.str();
}

std::string toStringSecp256k1_Scalar(const secp256k1_scalar& input) {
  std::stringstream out;
  for (int i = 7; i >= 0; i --)
    out << std::hex << std::setfill('0') << std::setw(8) << input.d[i];
  return out.str();
}

std::string toStringSecp256k1_ECPoint(const secp256k1_ge& input) {
  std::stringstream out;
  out << "\nx: " << toStringSecp256k1_FieldElement(input.x);
  out << "\ny: " << toStringSecp256k1_FieldElement(input.y);
  return out.str();
}

std::string toStringSecp256k1_ECPointProjective(const secp256k1_gej& input) {
  std::stringstream out;
  out << "\nx: " << toStringSecp256k1_FieldElement(input.x);
  out << "\ny: " << toStringSecp256k1_FieldElement(input.y);
  out << "\nz: " << toStringSecp256k1_FieldElement(input.z);
  return out.str();
}

std::string toStringSecp256k1_ECPointStorage(const secp256k1_ge_storage& input) {
  std::stringstream out;
  out << "(x,y): " << toStringSecp256k1_FieldElementStorage(input.x);
  out << ",   " << toStringSecp256k1_FieldElementStorage(input.y);
  return out.str();
}

std::string toStringSecp256k1_MultiplicationContext(const secp256k1_ecmult_context& multiplicationContext, bool fullDetail) {
  std::stringstream out;
  int topSuppressBoundary = ECMULT_TABLE_SIZE(WINDOW_G) - 10;
  for (int i = 0; i < ECMULT_TABLE_SIZE(WINDOW_G); i ++){
    if (!fullDetail) {
      if (i >= 10 && i < topSuppressBoundary){
        if (i == 10)
          out << "...\n";
        continue;
      }
    }
    out << i << ":" << toStringSecp256k1_ECPointStorage((*multiplicationContext.pre_g)[i]) << ", \n";
  }
  return out.str();
}

std::string toStringSecp256k1_GeneratorContext(const secp256k1_ecmult_gen_context& generatorContext, bool fullDetail) {
  std::stringstream out;
  out << "Blind: " << toStringSecp256k1_Scalar(generatorContext.blind) << "\n";
  out << "Initial: " << toStringSecp256k1_ECPointProjective(generatorContext.initial) << "\n";
  int numToDisplayAtEnd = 10;
  int topSuppressBoundary = 64 * 16 - numToDisplayAtEnd;
  int indexDisplayed = - 1;
  //logTest << "prec: " << std::hex << (long) generatorContext.prec << Logger::endL;
  //logTest << "&prec[0]: " << std::hex << (long) &(generatorContext.prec[0]) << Logger::endL;
  //logTest << "&prec[0].x: " << std::hex << (long) &(generatorContext.prec[0].x) << Logger::endL;
  //logTest << "&prec[0].y: " << std::hex << (long) &(generatorContext.prec[0].y) << Logger::endL;
  //logTest << "&prec[0].x.n[0]: " << std::hex << (long) &(generatorContext.prec[0].x.n[0]) << Logger::endL;
  //logTest << "&prec[0].y.n[0]: " << std::hex << (long) &(generatorContext.prec[0].y.n[0]) << Logger::endL;
  //logTest << "prec[0].y.n[0]: " << std::hex << (generatorContext.prec[0].y.n[0]) << Logger::endL;
  for (int i = 0; i < 64; i ++) {
    for (int j = 0; j < 16; j ++) {
      indexDisplayed ++;
      if (!fullDetail) {
        if (indexDisplayed >= numToDisplayAtEnd && indexDisplayed < topSuppressBoundary) {
          if (indexDisplayed == numToDisplayAtEnd){
            out << "...\n";
          }
          continue;
        }
      }
      //logTest << "Got to here: i,j: " << i << ", " << j << Logger::endL;
      //logTest << "prec[16 * i + j].x.n[0]: " << generatorContext.prec[16 * i + j].x.n[0] << Logger::endL;
      out << "p_" << i << "_" << j << ": " << toStringSecp256k1_ECPointStorage(generatorContext.prec[16 * i + j]) << ",\n";
    }
  }
  return out.str();
}

std::string toStringErrorLog(const unsigned char* memoryPool) {
  std::string result;
  for (int i = memoryPool_readNumberReservedBytesExcludingLog(); i < 1000; i ++) {
    if (memoryPool[i] == '\0')
      break;
    result.push_back((char) memoryPool[i]);
  }

  return result;
}

std::string toStringOutputObject(int argumentIndex, const unsigned char* memoryPool, int memoryPoolMaxSize) {
  secp256k1_ge readerECPoint;
  secp256k1_gej readerECPointProjective;
  secp256k1_fe readerFieldElement1;
  std::stringstream out;
  if (argumentIndex > MACRO_numberOfOutputs || argumentIndex < 0) {
    logGPU << "Memory pool output index " << argumentIndex << " out of bounds. ";
    assert(false);
  }
  unsigned int position = memoryPool_read_uint_fromOutput(argumentIndex, memoryPool);
  out << "Position " << position << ": ";
  if (position == 0) {
    out << "empty";
    return out.str();
  }
  if (position >= (unsigned) memoryPoolMaxSize) {
    out << "(position invalid)";
    return out.str();
  }
  if (position < memoryPool_readNumberReservedBytesIncludingLog()) {
    return out.str();
  }
  unsigned int theType = memoryPool_read_uint(&memoryPool[position]);
  switch (theType) {
  case memoryPoolType_ge:
    memoryPool_read_secp256k1_ge(&readerECPoint, &memoryPool[position + sizeof_uint()]);
    out << "EC point: " << toStringSecp256k1_ECPoint(readerECPoint);
    break;
  case memoryPoolType_fe:
    memoryPool_read_secp256k1_fe(&readerFieldElement1, &memoryPool[position + sizeof_uint()]);
    out << "Field element: " << toStringSecp256k1_FieldElement(readerFieldElement1);
    break;
  case memoryPoolType_gej:
    memoryPool_read_secp256k1_gej(&readerECPointProjective, &memoryPool[position + sizeof_uint()]);
    out << "EC point projective: " << toStringSecp256k1_ECPointProjective(readerECPointProjective);
    break;
  default:
    out << "Unknown object type: " << theType;
    break;
  }
  return out.str();
}
